/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      home: "aws",
      name: "focube",
      removal: input?.stage === "production" ? "retain" : "remove",
    };
  },
  async run() {
    new sst.aws.StaticSite("FocubeWeb", {
      build: {
        command: "npm run build",
        output: "dist",
      },
      dev: {
        command: "npm run dev",
      },
      path: ".",
    });
  },
});
