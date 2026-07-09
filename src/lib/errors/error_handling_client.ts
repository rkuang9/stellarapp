"use client"

export async function logError({ source, code, description }: {
    source: string;
    code: string;
    description: string;
}) {
    const log_error = process.env.NEXT_PUBLIC_LOG_ERROR!;
    
    if (!log_error) {
        return;
    }

    return await fetch(new URL(log_error, self.location.origin), {
        method: "PUT",
        body: JSON.stringify({ source, code, description }),
    })
}
