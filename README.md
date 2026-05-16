Ruimte & Kunst Advies — API
Serverless API-functie voor de Ruimte & Kunst Advies tool op artmakessense.life. Gebouwd met Vercel en de Anthropic Claude API.
Wat doet het
Ontvangt een foto van een ruimte, analyseert deze met Claude en geeft concrete aanbevelingen terug over kunstpresentatie en inrichting.
Endpoint
POST /api/analyze
Body: { "image": "<base64>", "mediaType": "image/jpeg" }
Response: JSON met aanbevelingen
Instellen
Voeg een environment variable toe in Vercel:
ANTHROPIC_API_KEY = jouw Anthropic API-sleutel
Onderdeel van
Artmakessense — redactioneel platform voor beeldende kunst
