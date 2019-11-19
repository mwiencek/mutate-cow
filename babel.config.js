module.exports = function (api) {
  api.cache.forever();

  const presets = [
    ['@babel/preset-env', {
      targets: {
        ie: '11',
      },
    }],
  ];

  const plugins = [
    ['@babel/plugin-transform-runtime', {
      corejs: 3,
      helpers: true,
      regenerator: false,
      useESModules: false,
    }],
  ];

  return {
    presets,
    plugins,
    sourceType: 'unambiguous',
  };
};
