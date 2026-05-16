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
    "Geef je antwoord ALLEEN als geldig JSON. Geen markdown, geen uitleg, geen apostroffen in de tekst.",
    "Formaat: {\"annotations\":[{\"id\":1,\"title\":\"Titel\",\"advice\":\"Advies\",\"category\":\"kunst\",\"x\":0.45,\"y\":0.30,\"arrow_to_x\":0.55,\"arrow_to_y\":0.25}]}",
    "",
    "Regels:",
    "- category is kunst of inrichting",
    "- Geen apostrof of aanhalingsteken in title of advice",
    "- x/y zijn labelposities (0.0=links/boven, 1.0=rechts/onder)",
    "- arrow_to_x/y wijst naar de exacte plek in de foto",
    "- Spreid labels, voorkom overlap",
    "- Schrijf in het Nederlands",
    "- Retourneer ALLEEN de JSON"
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
        max_tokens: 1200,
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

    // Extract the JSON object
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Geen JSON gevonden in response' });

    let raw = match[0];

    // Fix string values only: sanitize inside quoted strings
    // Replace problematic chars inside JSON string values
    raw = raw
      .replace(/[\r\n\t]/g, ' ')           // newlines/tabs to space
      .replace(/\u2018|\u2019/g, '')        // curly single quotes (apostrophes)
      .replace(/\u201C|\u201D/g, '')        // curly double quotes
      .replace(/\u2013|\u2014/g, '-')       // em/en dashes
      .replace(/\u2026/g, '...')            // ellipsis
      .replace(/[^\x20-\x7E\u00C0-\u024F]/g, ' '); // non-latin chars to space

    // Parse with fallback field-by-field extraction
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e) {
      // Fallback: extract annotations manually using regex
      const annotations = [];
      const annRegex = /"id"\s*:\s*(\d+)[^}]*?"title"\s*:\s*"([^"]*)"[^}]*?"advice"\s*:\s*"([^"]*)"[^}]*?"category"\s*:\s*"([^"]*)"[^}]*?"x"\s*:\s*([\d.]+)[^}]*?"y"\s*:\s*([\d.]+)[^}]*?"arrow_to_x"\s*:\s*([\d.]+)[^}]*?"arrow_to_y"\s*:\s*([\d.]+)/g;
      let m;
      while ((m = annRegex.exec(raw)) !== null) {
        annotations.push({
          id: parseInt(m[1]),
          title: m[2],
          advice: m[3],
          category: m[4],
          x: parseFloat(m[5]),
          y: parseFloat(m[6]),
          arrow_to_x: parseFloat(m[7]),
          arrow_to_y: parseFloat(m[8])
        });
      }
      if (annotations.length === 0) {
        return res.status(500).json({ error: 'Kon aanbevelingen niet verwerken. Probeer opnieuw.' });
      }
      parsed = { annotations };
    }

    res.status(200).json(parsed);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
