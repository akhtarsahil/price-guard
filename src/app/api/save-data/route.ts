import { NextRequest, NextResponse } from "next/server";
import { exportSaveData, importSaveData, hasSaveFile, getSaveFilePath } from "@/lib/mock-persistence";

/**
 * GET /api/save-data
 * 
 * Download the current mock save file as JSON.
 * The user can store this file externally and re-import it later.
 */
export async function GET() {
  const data = exportSaveData();

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="price-guard-save.json"',
    },
  });
}

/**
 * POST /api/save-data
 * 
 * Import a previously exported save file. Overwrites all current mock data.
 * Body: the full save JSON object.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body._meta || !body.stores) {
      return NextResponse.json(
        { error: "Invalid save file format. Must have _meta and stores fields." },
        { status: 400 }
      );
    }

    const success = importSaveData(body);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to import save file. Check version compatibility." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Save data imported successfully. Restart the server to load the new data.",
      storesImported: Object.keys(body.stores),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to import save data" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/save-data
 * 
 * Reset mock data by deleting the save file.
 * On next server restart, seed data will be regenerated.
 */
export async function DELETE() {
  try {
    const fs = require("fs");
    const path = getSaveFilePath();

    if (hasSaveFile()) {
      fs.unlinkSync(path);
    }

    return NextResponse.json({
      success: true,
      message: "Save data deleted. Restart the server to regenerate seed data.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete save data" },
      { status: 500 }
    );
  }
}
