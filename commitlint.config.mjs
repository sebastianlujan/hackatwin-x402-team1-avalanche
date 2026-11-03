export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Dependabot bodies contain long lines.
    "body-max-line-length": [0],
  },
};
