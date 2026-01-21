import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as Blob;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
        }

        const groqFormData = new FormData();
        groqFormData.append("file", file, "audio.wav");
        groqFormData.append("model", "whisper-large-v3");

        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqApiKey}`,
            },
            body: groqFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Groq API error:", errorText);
            return NextResponse.json({ error: "Transcription failed" }, { status: response.status });
        }

        const result = await response.json();
        return NextResponse.json({ text: result.text });
    } catch (error) {
        console.error("Transcribe error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
