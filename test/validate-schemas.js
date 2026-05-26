/**
 * JSON Schema validation for rue2.cz data files.
 * Run: node test/validate-schemas.js
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ROOT = path.resolve(__dirname, '..');
const ajv = new Ajv({ allErrors: true, strict: false });

let failures = 0;
let passes = 0;

function fail(msg) { failures++; console.error('  FAIL: ' + msg); }
function pass() { passes++; }

function validateFile(filePath, schema, label) {
  try {
    var data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(label + ': invalid JSON — ' + e.message);
    return;
  }
  var validate = ajv.compile(schema);
  if (validate(data)) {
    pass();
  } else {
    validate.errors.forEach(function(err) {
      fail(label + ': ' + err.instancePath + ' ' + err.message);
    });
  }
}

console.log('\n1. topics.json schema');
var topicSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/topic.schema.json'), 'utf8'));
validateFile(path.join(ROOT, 'topics.json'), topicSchema, 'topics.json');

console.log('\n2. questions.json schema');
var questionsSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/questions.schema.json'), 'utf8'));
validateFile(path.join(ROOT, 'questions.json'), questionsSchema, 'questions.json');

console.log('\n3. Exam file schemas');
var examSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/exam.schema.json'), 'utf8'));
var examFiles = ['exam_open_cloze.json', 'exam_open_cloze_free.json', 'exam_word_formation.json', 'exam_sentence_transformation.json'];
examFiles.forEach(function(file) {
  var fp = path.join(ROOT, '_exam_app', file);
  if (fs.existsSync(fp)) validateFile(fp, examSchema, '_exam_app/' + file);
});

console.log('\n4. Curriculum file schemas');
var currSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/curriculum.schema.json'), 'utf8'));
var currFiles = fs.readdirSync(ROOT).filter(function(f) { return f.startsWith('curriculum') && f.endsWith('.json'); });
currFiles.forEach(function(file) {
  validateFile(path.join(ROOT, file), currSchema, file);
});

console.log('\n────────────────────────────────');
console.log('Passed: ' + passes);
console.log('Failed: ' + failures);
if (failures > 0) {
  console.log('\nSchema validation FAILED with ' + failures + ' error(s).');
  process.exit(1);
} else {
  console.log('\nAll schema checks passed.');
  process.exit(0);
}
