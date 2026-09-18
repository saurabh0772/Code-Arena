const express = require('express');
const path = require('path');
const fs = require('fs');
const swaggerUiDist = require('swagger-ui-dist');

const router = express.Router();

let cachedSpec = null;

function getOpenApiSpec() {
  if (!cachedSpec) {
    const specPath = path.join(__dirname, 'openapi.json');
    const raw = fs.readFileSync(specPath, 'utf8');
    cachedSpec = JSON.parse(raw);
  }

  return cachedSpec;
}

// Middleware to relax CSP specifically for Swagger UI documentation pages & assets
router.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
  );
  next();
});

// OpenAPI JSON
router.get('/json', (req, res) => {
  res.json(getOpenApiSpec());
});

// Custom Swagger initializer script
router.get('/swagger-initializer.js', (req, res) => {
  const js = `window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: "/api/v1/docs/json",
    dom_id: "#swagger-ui",
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    layout: "BaseLayout"
  });
};`;
  res.type('application/javascript').send(js);
});

// Swagger UI assets
router.use('/assets', express.static(swaggerUiDist.getAbsoluteFSPath()));

// Swagger UI
router.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeArena API Documentation</title>

  <link
    rel="stylesheet"
    type="text/css"
    href="/api/v1/docs/assets/swagger-ui.css"
  />

  <style>
    html {
      box-sizing: border-box;
      overflow-y: scroll;
    }

    *,
    *:before,
    *:after {
      box-sizing: inherit;
    }

    body {
      margin: 0;
      background: #0f172a;
      font-family: sans-serif;
    }

    .topbar {
      display: none !important;
    }
  </style>
</head>

<body>
  <div id="swagger-ui"></div>

  <script src="/api/v1/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/v1/docs/assets/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/api/v1/docs/json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;

  res.type('html').send(html);
});

module.exports = router;