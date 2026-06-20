import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/email-templates?type=internal|external
 * Fetch all email templates (system + user's own)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get("type"); // 'internal' or 'external'

    // Build query - fetch system templates and user's own templates
    let query = supabase
      .from("email_templates")
      .select("*")
      .or(`is_system.eq.true,broker_id.eq.${user.id}`)
      .eq("is_active", true);

    // Filter by template type if specified
    if (templateType) {
      query = query.eq("template_type", templateType);
    }

    const { data: templates, error } = await query
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates", message: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/email-templates
 * Create a new email template
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      subject,
      body: templateBody,
      description,
      template_type,
    } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: "Name, subject, and body are required" },
        { status: 400 },
      );
    }

    const { data: template, error } = await supabase
      .from("email_templates")
      .insert({
        broker_id: user.id,
        name,
        subject,
        body: templateBody,
        description,
        template_type: template_type || "external", // Default to external for user templates
        is_system: false,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error("Error creating email template:", error);
    return NextResponse.json(
      { error: "Failed to create template", message: error.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/email-templates
 * Update an existing template
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, subject, body: templateBody, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 },
      );
    }

    // Update template (RLS will ensure user owns it)
    const { data: template, error } = await supabase
      .from("email_templates")
      .update({
        name,
        subject,
        body: templateBody,
        description,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error("Error updating email template:", error);
    return NextResponse.json(
      { error: "Failed to update template", message: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/email-templates
 * Delete a template (admin only for system templates)
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 },
      );
    }

    // Check if template exists and if it's a system template
    const { data: template, error: fetchError } = await supabase
      .from("email_templates")
      .select("is_system, name, broker_id")
      .eq("id", id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // If system template, require admin access
    if (template.is_system) {
      const { data: broker } = await supabase
        .from("brokers")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!broker?.is_admin) {
        return NextResponse.json(
          { error: "Admin access required to delete system templates" },
          { status: 403 },
        );
      }
    }

    // Check ownership for non-system templates
    if (!template.is_system && template.broker_id !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own templates" },
        { status: 403 },
      );
    }

    // Use service role to bypass RLS for system templates
    const { createClient: createServiceClient } = await import(
      "@supabase/supabase-js"
    );
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Soft delete by setting is_active=false (preserves history)
    const { error: deleteError } = await serviceSupabase
      .from("email_templates")
      .update({ is_active: false })
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete template", message: deleteError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting email template:", error);
    return NextResponse.json(
      { error: "Failed to delete template", message: error.message },
      { status: 500 },
    );
  }
}
