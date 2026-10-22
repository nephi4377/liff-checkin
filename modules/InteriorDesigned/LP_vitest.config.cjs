const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
    test: {
        environment: 'node',
        include: ['LP_core.test.js', 'LP_3D_scene.test.js'],
    },
});
