import { NextRequest, NextResponse } from "next/server";

// Force Node.js runtime (MJML doesn't work in Edge runtime)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/email-templates/compile  
 * Compiles MJML code to HTML for preview
 */
export async function POST(request: NextRequest) {
  try {
    const { mjmlCode } = await request.json();

    if (!mjmlCode || mjmlCode.trim().length === 0) {
      return NextResponse.json(
        { error: "No MJML code provided" },
        { status: 400 },
      );
    }

    // Dynamic import to avoid bundling issues
    const mjml2html = (await import("mjml")).default;
    const result = mjml2html(mjmlCode, {
      validationLevel: "soft", // Don't fail on warnings
      minify: false, // Disable minification to avoid uglify-js issues
    });

    if (result.errors.length > 0) {
      console.error("MJML compilation errors:", result.errors);
      return NextResponse.json(
        {
          error: "MJML compilation failed",
          errors: result.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ html: result.html });
  } catch (error: any) {
    console.error("Compile API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
