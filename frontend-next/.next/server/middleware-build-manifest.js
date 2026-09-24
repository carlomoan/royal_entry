self.__BUILD_MANIFEST = {
  "polyfillFiles": [
    "static/chunks/polyfills.js"
  ],
  "devFiles": [
    "static/chunks/react-refresh.js"
  ],
  "ampDevFiles": [],
  "lowPriorityFiles": [],
  "rootMainFiles": [],
  "pages": {
    "/_app": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_app.js"
    ],
    "/_error": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_error.js"
    ],
    "/cards": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/cards.js"
    ],
    "/platform": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/platform.js"
    ],
    "/platform/accounts": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/platform/accounts.js"
    ],
    "/platform/card-templates": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/platform/card-templates.js"
    ]
  },
  "ampFirstPages": []
};
self.__BUILD_MANIFEST.lowPriorityFiles = [
"/static/" + process.env.__NEXT_BUILD_ID + "/_buildManifest.js",
,"/static/" + process.env.__NEXT_BUILD_ID + "/_ssgManifest.js",

];