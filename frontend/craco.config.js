// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
  enableVisualEdits: isDevServer,
};

// Conditionally load visual edits modules
let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
  try {
    setupDevServer = require("./plugins/visual-edits/dev-server-setup");
    babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
  } catch (e) {
    // console.warn("Visual edits plugins not found, skipping...");
  }
}

// Conditionally load health check modules
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  try {
    WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
    setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
    healthPluginInstance = new WebpackHealthPlugin();
  } catch (e) {
    // console.warn("Health check plugins not found, skipping...");
  }
}

module.exports = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig, { env, paths }) => {
      // 1. Configura Watch Options (Ignorar pastas pesadas)
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/build/**',
          '**/dist/**',
          '**/coverage/**',
          '**/public/**',
        ],
      };

      // 2. Adiciona plugin de Health Check se ativado
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      // 3. A CORREÇÃO DE OURO: Remover ForkTsCheckerWebpackPlugin
      // Isso impede que o erro "Unknown keyword formatMinimum" aconteça
      webpackConfig.plugins = webpackConfig.plugins.filter(
        (plugin) => plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin'
      );

      return webpackConfig;
    },
  },
  // Configuração do Babel (Visual Edits)
  babel: config.enableVisualEdits && babelMetadataPlugin ? {
    plugins: [babelMetadataPlugin],
  } : {},
  // Configuração do DevServer
  devServer: (devServerConfig) => {
    // Apply visual edits setup
    if (config.enableVisualEdits && setupDevServer) {
      devServerConfig = setupDevServer(devServerConfig);
    }

    // Add health check endpoints
    if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
      const originalSetupMiddlewares = devServerConfig.setupMiddlewares;
      devServerConfig.setupMiddlewares = (middlewares, devServer) => {
        if (originalSetupMiddlewares) {
          middlewares = originalSetupMiddlewares(middlewares, devServer);
        }
        setupHealthEndpoints(devServer, healthPluginInstance);
        return middlewares;
      };
    }
    return devServerConfig;
  }
};