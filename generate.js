const fs = require('fs');
const name = process.argv[2];

if (!name) {
  console.log('❌ Please provide a name like: node generate.js user');
  process.exit();
}

const capName = name.charAt(0).toUpperCase() + name.slice(1);

const modelContent = `// ${capName} Model
module.exports = {
  // Define DB functions here
};`;

const controllerContent = `// ${capName} Controller
exports.sample = (req, res) => {
  res.send('${name} controller working!');
};`;

const routeContent = `const express = require('express');
const router = express.Router();
const ${name}Controller = require('../controllers/${name}Controller');

// Define routes here
router.get('/sample', ${name}Controller.sample);

module.exports = router;`;

fs.mkdirSync(`models`, { recursive: true });
fs.writeFileSync(`models/${name}Model.js`, modelContent);

fs.mkdirSync(`controllers`, { recursive: true });
fs.writeFileSync(`controllers/${name}Controller.js`, controllerContent);

fs.mkdirSync(`routes`, { recursive: true });
fs.writeFileSync(`routes/${name}Routes.js`, routeContent);

console.log(`✅ ${name} MCR structure created!`);
