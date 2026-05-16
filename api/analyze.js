export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mediaType } = req.body;
  if (!image || !mediaType) return res.status(400).json({ error: 'Ontbrekende velden' });

  const prompt = [
    "Je bent een interieur- en kunstpresentatie-expert.",
    "Analyseer deze foto en geef 5 tot 7 concrete aanbevelingen.",
    "Kijk breed: kunstpresentatie (plaatsing, hoogte, groepering, verlichting) EN inrichting (meubels, planten, opruiming, kleur, balans).",
    "",
    "BELANGRIJK: Gebruik in de tekstvelden GEEN aanhalingstekens, apostroffen of speciale tekens. Schrijf gewoon lopende tekst zonder leestekens die JSON kunnen breken.",
    "",
    "Geef je antwoord ALLEEN als geldig JSON, geen markdown, geen uitleg. Formaat:",
    "{\"annotations\":[{\"id\":1,\"title\":\"Titel zonder aanhalingstekens\",\"advice\":\"Advies zonder apostroffen of aanhalingstekens.\",\"category\":\"kunst\",\"x\":0.45,\"y\":0.30,\"arrow_to_x\":0.55,\"arrow_to_y\":0.25}]}",
    "",
    "Regels:",
    "- category is kunst of inrichting",
    "- x en y zijn de labelposities (0.0=links/boven, 1.0=rechts/onder)",
    "- arrow_to_x en arrow_to_y wijzen naar de exacte plek in de foto",
    "- Spreid de labels over de foto, voorkom overlap",
    "- Schrijf in het Nederlands",
    "- Retourneer ALLEEN de JSON, niets anders"
  ].join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content?.find(b => b.type === 'text')?.text || '';

    // Extract JSON robustly
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Geen geldig JSON in response' });

    // Sanitize: remove control characters that break JSON
    const sanitized = match[0]
      .replace(/[\u0000-\u001F\u007F]/g, ' ')  // control chars
      .replace(/\t/g, ' ')                       // tabs
      .replace(/\r?\n/g, ' ');                   // newlines inside strings

    let parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch(e) {
      // Last resort: try to extract annotations array manually
      return res.status(500).json({ error: 'JSON parse fout: ' + e.message });
    }

    res.status(200).json(parsed);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
