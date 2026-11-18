import { NextRequest, NextResponse } from "next/server";
import { LearnerProfile, AnalogyBackground, DomainType } from "@/types/agent";

// In-memory session store (can also sync with localStorage in the client)
const currentProfile: LearnerProfile = {
  id: "learner-user-1",
  name: "Learner",
  analogyBackground: "Fullstack Web Developer",
  activeDomain: "",
  overallMastery: 0,
  learningStreakDays: 1,
  totalDrillsCompleted: 0,
  trapTendencies: {},
  recentMisconceptions: [],
  retentionAlertCount: 0,
};

export async function GET() {
  return NextResponse.json(currentProfile);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.analogyBackground) {
      currentProfile.analogyBackground =
        body.analogyBackground as AnalogyBackground;
    }
    if (body.activeDomain) {
      currentProfile.activeDomain = body.activeDomain as DomainType;
    }
    if (typeof body.overallMastery === "number") {
      currentProfile.overallMastery = body.overallMastery;
    }
    return NextResponse.json(currentProfile);
  } catch {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 400 },
    );
  }
}
