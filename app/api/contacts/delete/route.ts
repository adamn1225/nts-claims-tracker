import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get contact ID(s) from request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { contactId, contactIds } = body;

    // Support both single and bulk delete
    const idsToDelete = contactIds || (contactId ? [contactId] : []);

    if (idsToDelete.length === 0) {
      console.error("No contact IDs provided. Body:", body);
      return NextResponse.json(
        { error: "Contact ID(s) required", receivedBody: body },
        { status: 400 }
      );
    }

    // Check user permissions
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("is_admin, is_manager")
      .eq("id", user.id)
      .single();

    if (!teamMember) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    console.log(`User ${user.id} attempting to delete ${idsToDelete.length} contacts`);
    console.log(`User role - Admin: ${teamMember.is_admin}, Manager: ${teamMember.is_manager}`);

    // Batch delete to avoid query size limits (max 100 IDs per batch)
    const BATCH_SIZE = 100;
    let totalDeleted = 0;
    const errors: any[] = [];

    for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
      const batch = idsToDelete.slice(i, i + BATCH_SIZE);
      
      const { error: deleteError, count } = await supabase
        .from("customers")
        .delete()
        .in("id", batch);

      if (deleteError) {
        console.error(`Error deleting batch ${i / BATCH_SIZE + 1}:`, deleteError);
        errors.push({
          batch: i / BATCH_SIZE + 1,
          error: deleteError.message,
          idsCount: batch.length
        });
      } else {
        totalDeleted += count || batch.length;
      }
    }

    if (errors.length > 0) {
      console.error("Errors during batch deletion:", errors);
      return NextResponse.json(
        { 
          error: `Failed to delete some contacts. Deleted ${totalDeleted} of ${idsToDelete.length}`,
          details: errors,
          partialSuccess: totalDeleted > 0,
          deletedCount: totalDeleted
        },
        { status: 207 } // 207 Multi-Status for partial success
      );
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount: totalDeleted 
    }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in delete endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
