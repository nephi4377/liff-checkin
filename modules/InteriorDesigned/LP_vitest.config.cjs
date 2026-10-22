const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
    test: {
        environment: 'node',
        include: [
            'LP_core.test.js',
            'LP_3D_scene.test.js',
            'LP_3D_furniture.test.js',
            'LP_3D_snapshot.test.js',
            'LP_3D_walk.test.js',
            'LP_3D_walk_collision.test.js',
            'LP_LayoutPlanner_3d_lazy.test.js',
            'LP_layout_history.test.js',
            'LP_quotation_budgetweb_export.test.js',
        ],
    },
});
