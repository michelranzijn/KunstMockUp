// Ruimte & Kunst Advies API — versie 1.5
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mediaType, prompt } = req.body;
  if (!image || !mediaType) return res.status(400).json({ error: 'Ontbrekende velden' });

  // Use prompt from app, or fallback
  const finalPrompt = prompt || [
    "Je bent een interieur- en kunstpresentatie-expert.",
    "Analyseer deze foto en geef 5 tot 7 concrete aanbevelingen.",
    "Begin met een oprecht, specifiek compliment over iets dat al goed werkt in de ruimte.",
    "Kijk breed: kunstpresentatie EN inrichting.",
    "",
    "Geef je antwoord ALLEEN als geldig JSON. Geen markdown, geen apostrof in tekstvelden.",
    '{"compliment":"Wat hier al heel goed werkt is...","annotations":[{"id":1,"title":"Titel","advice":"Advies","category":"kunst","x":0.45,"y":0.30,"arrow_to_x":0.55,"arrow_to_y":0.25}]}',
    "",
    "Regels: category is kunst of inrichting. Schrijf in het Nederlands. Retourneer ALLEEN de JSON."
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
            { type: "text", text: finalPrompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Geen JSON gevonden' });

    let raw = match[0]
      .replace(/[\r\n\t]/g, ' ')
      .replace(/\u2018|\u2019/g, '')
      .replace(/\u201C|\u201D/g, '')
      .replace(/\u2013|\u2014/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[^\x20-\x7E\u00C0-\u024F]/g, ' ');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e) {
      // Regex fallback
      const annotations = [];
      const re = /"id"\s*:\s*(\d+)[^}]*?"title"\s*:\s*"([^"]*)"[^}]*?"advice"\s*:\s*"([^"]*)"[^}]*?"category"\s*:\s*"([^"]*)"[^}]*?"x"\s*:\s*([\d.]+)[^}]*?"y"\s*:\s*([\d.]+)[^}]*?"arrow_to_x"\s*:\s*([\d.]+)[^}]*?"arrow_to_y"\s*:\s*([\d.]+)/g;
      let m;
      while ((m = re.exec(raw)) !== null) {
        annotations.push({ id: parseInt(m[1]), title: m[2], advice: m[3], category: m[4], x: parseFloat(m[5]), y: parseFloat(m[6]), arrow_to_x: parseFloat(m[7]), arrow_to_y: parseFloat(m[8]) });
      }
      if (annotations.length === 0) return res.status(500).json({ error: 'Kon aanbevelingen niet verwerken. Probeer opnieuw.' });
      parsed = { annotations };
    }

    res.status(200).json(parsed);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
