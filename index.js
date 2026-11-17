const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.redirect("/index.html");
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Message harus diisi",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY belum diatur",
      });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: message }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 13192,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API Error:", errorData);
      return res.status(response.status).json({
        error: "Gagal memanggil Gemini API",
        details: errorData,
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine || !trimmedLine.startsWith("data:")) {
          continue;
        }

        const data = trimmedLine.slice(5).trim();
        if (data === "[DONE]") {
          continue;
        }

        try {
          const json = JSON.parse(data);
          const content = json.candidates?.[0]?.content?.parts
            ?.map((part) => part.text || "")
            .join("");
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch (error) {
          console.error("Gagal parsing streaming data dari Gemini:", error);
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Server Error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Terjadi kesalahan pada server",
      });
    }

    res.write(`data: ${JSON.stringify({ error: "Terjadi kesalahan pada server" })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`server berjalan di http://localhost:${PORT}`);
});
