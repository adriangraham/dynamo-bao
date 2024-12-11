#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { loadModelDefinitions } = require('./codegen');
const { generateModelFiles } = require('./generators/model');

function loadConfig() {
  const configPath = path.resolve(process.cwd(), './config.js');
  try {
    return require(configPath);
  } catch (error) {
    console.error('Error loading config.js from current directory:', error.message);
    process.exit(1);
  }
}

function generateModels(definitionsPath) {
  const config = loadConfig();
  console.log(`Generating models from: ${definitionsPath}`);
  console.log(`Output directory: ${config.paths.modelsDir}`);
  
  try {
    const definitions = loadModelDefinitions(definitionsPath);
    generateModelFiles(definitions.models, config.paths.modelsDir);
    console.log('Models generated successfully');
  } catch (error) {
    console.error('Error generating models:', error);
  }
}

function getDefinitionsPath(config) {
  if (config.paths.modelsDefinitionPath) {
    const definitionPath = path.resolve(process.cwd(), config.paths.modelsDefinitionPath);
    return definitionPath;
  }
  // Fall back to models.yaml in current directory
  return path.resolve(process.cwd(), './models.yaml');
}

function main() {
  const config = loadConfig();
  const definitionsPath = getDefinitionsPath(config);

  // Initial generation
  generateModels(definitionsPath);

  // Set up watcher with appropriate glob pattern
  const isDirectory = fs.statSync(definitionsPath).isDirectory();
  const watchPattern = isDirectory
    ? path.join(definitionsPath, '**/*.{yaml,yml}')  // Watch all yaml files in directory
    : definitionsPath;  // Watch single file directly

  const watcher = chokidar.watch(watchPattern, {
    persistent: true,
    ignoreInitial: true,
  });

  console.log(`Watching for changes in: ${watchPattern}`);

  watcher
    .on('change', (path) => generateModels(path))
    .on('add', (path) => generateModels(path))
    .on('error', error => console.error(`Watcher error: ${error}`));
}

if (require.main === module) {
  main();
} 