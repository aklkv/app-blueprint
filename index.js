const Blueprint = require('ember-cli/lib/models/blueprint');
const fs = require('fs-extra');
const { join } = require('path');
const emberCliUpdate = require('./lib/ember-cli-update');

const appBlueprint = Blueprint.lookup('app');

module.exports = {
  locals(options) {
    return appBlueprint.locals(options);
  },
  beforeInstall(options) {
    if (!appBlueprint) {
      throw new Error('Cannot find app blueprint for generating test-app!');
    }

    return appBlueprint.install({
      ...options,
      skipGit: true,
    });
  },

  async updateDeps(options) {
    // this.addPackagesToProject doesn't respect the packageManager that the blueprint specified 🙈 so we're skipping a level here
    let installTask = this.taskFor('npm-install');
    await installTask.run({
      'save-dev': true,
      verbose: false,
      packages: [
        '@embroider/core@unstable',
        '@embroider/vite@unstable',
        '@embroider/compat@unstable',
        '@embroider/test-setup@unstable',
        'vite',
        '@rollup/plugin-babel',
      ],
      packageManager: options.packageManager,
    });

    let uninstallTask = this.taskFor('npm-uninstall');
    await uninstallTask.run({
      'save-dev': true,
      verbose: false,
      packages: [
        'ember-fetch',
        'broccoli-asset-rev',
        'ember-cli-app-version',
        'ember-cli-clean-css',
        'ember-cli-dependency-checker',
        'ember-cli-sri',
        'ember-cli-terser',
      ],
      packageManager: options.packageManager,
    });
  },

  async afterInstall(options) {
    // there doesn't seem to be a way to tell ember-cli to not prompt to override files that were added in the beforeInstall
    // so I'm just copying a few over at this stage
    await fs.copy(join(__dirname, 'files-override'), options.target, {
      overwrite: true,
    });

    let packageJson = join(options.target, 'package.json');
    let json = await fs.readJSON(packageJson);

    json.scripts = {
      ...json.scripts,
      build: 'vite build',
      start: 'vite',
      'test:ember': 'vite build --mode test && ember test --path dist',
    };

    await fs.writeFile(packageJson, JSON.stringify(json, null, 2));

    await emberCliUpdate({
      projectDir: options.target,
      projectName: options.projectName,
      version: require('./package.json').version,
      options,
    });

    await this.updateDeps(options);
  },
};
