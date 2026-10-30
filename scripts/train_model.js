import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const csvPath = path.resolve('public/assets/aistudio/bank_muscat_customer_reviews_5000_4cd0661a.csv');
const rawCsv = fs.readFileSync(csvPath, 'utf8');

const parsed = Papa.parse(rawCsv, {
  header: true,
  skipEmptyLines: true,
});

console.log(`Loaded ${parsed.data.length} rows from CSV`);

// Sentiment counts
const counts = { Positive: 0, Negative: 0, Neutral: 0 };
parsed.data.forEach((r) => {
  if (counts[r.sentiment] !== undefined) {
    counts[r.sentiment]++;
  }
});
console.log('Sentiment distribution:', counts);

// Build vocabulary and TF-IDF
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
  'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
  'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
  'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 'll', 'm',
  'o', 're', 've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn',
  'haven', 'isn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn',
  'weren', 'won', 'wouldn'
]);

function tokenize(text) {
  if (!text) return [];
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const unigrams = words;
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]}_${words[i+1]}`);
  }
  return [...unigrams, ...bigrams];
}

// Calculate Document Frequency
const docCount = parsed.data.length;
const docFreq = {};

parsed.data.forEach(r => {
  const tokens = new Set(tokenize(r.customer_review));
  tokens.forEach(tok => {
    docFreq[tok] = (docFreq[tok] || 0) + 1;
  });
});

// Select top N vocabulary items by frequency (min DF = 3, max DF = 0.85 * docCount)
const vocabList = Object.keys(docFreq).filter(
  tok => docFreq[tok] >= 3 && docFreq[tok] <= docCount * 0.85
);
vocabList.sort((a, b) => docFreq[b] - docFreq[a]);
const vocabulary = vocabList.slice(0, 1500);
const vocabIndex = new Map();
const idf = {};

vocabulary.forEach((tok, idx) => {
  vocabIndex.set(tok, idx);
  idf[tok] = Math.log((1 + docCount) / (1 + docFreq[tok])) + 1;
});

console.log(`Vocabulary size: ${vocabulary.length}`);

// Convert texts to TF-IDF vectors
function textToTfidf(text) {
  const tokens = tokenize(text);
  const termCounts = {};
  tokens.forEach(tok => {
    if (vocabIndex.has(tok)) {
      termCounts[tok] = (termCounts[tok] || 0) + 1;
    }
  });

  const vector = new Float32Array(vocabulary.length);
  let normSq = 0;
  for (const [tok, count] of Object.entries(termCounts)) {
    const idx = vocabIndex.get(tok);
    const tf = count / tokens.length;
    const val = tf * idf[tok];
    vector[idx] = val;
    normSq += val * val;
  }
  const norm = Math.sqrt(normSq) || 1;
  for (let i = 0; i < vector.length; i++) {
    vector[i] /= norm;
  }
  return vector;
}

// Prepare training data
const classes = ['Negative', 'Neutral', 'Positive'];
const classMap = { Negative: 0, Neutral: 1, Positive: 2 };

const X = [];
const y = [];
parsed.data.forEach(r => {
  if (classMap[r.sentiment] !== undefined) {
    X.push(textToTfidf(r.customer_review));
    y.push(classMap[r.sentiment]);
  }
});

// Multinomial Logistic Regression via Softmax SGD
const numFeatures = vocabulary.length;
const numClasses = 3;
const weights = Array.from({ length: numClasses }, () => new Float32Array(numFeatures));
const biases = new Float32Array(numClasses);

const learningRate = 0.2;
const l2Reg = 0.0001;
const epochs = 45;

for (let epoch = 0; epoch < epochs; epoch++) {
  let totalLoss = 0;
  for (let i = 0; i < X.length; i++) {
    const xi = X[i];
    const yi = y[i];

    // Compute logits
    const logits = new Float32Array(numClasses);
    let maxLogit = -Infinity;
    for (let c = 0; c < numClasses; c++) {
      let dot = biases[c];
      const wc = weights[c];
      for (let f = 0; f < numFeatures; f++) {
        if (xi[f] !== 0) {
          dot += wc[f] * xi[f];
        }
      }
      logits[c] = dot;
      if (dot > maxLogit) maxLogit = dot;
    }

    // Softmax probabilities
    const probs = new Float32Array(numClasses);
    let sumExp = 0;
    for (let c = 0; c < numClasses; c++) {
      probs[c] = Math.exp(logits[c] - maxLogit);
      sumExp += probs[c];
    }
    for (let c = 0; c < numClasses; c++) {
      probs[c] /= sumExp;
    }

    totalLoss += -Math.log(Math.max(probs[yi], 1e-15));

    // Gradient descent step
    for (let c = 0; c < numClasses; c++) {
      const error = probs[c] - (c === yi ? 1 : 0);
      biases[c] -= learningRate * error;
      const wc = weights[c];
      for (let f = 0; f < numFeatures; f++) {
        if (xi[f] !== 0) {
          wc[f] -= learningRate * (error * xi[f] + l2Reg * wc[f]);
        }
      }
    }
  }

  if ((epoch + 1) % 15 === 0) {
    console.log(`Epoch ${epoch + 1}/${epochs} - Loss: ${(totalLoss / X.length).toFixed(4)}`);
  }
}

// Evaluate Accuracy
let correct = 0;
for (let i = 0; i < X.length; i++) {
  const xi = X[i];
  let maxScore = -Infinity;
  let bestClass = 0;
  for (let c = 0; c < numClasses; c++) {
    let score = biases[c];
    const wc = weights[c];
    for (let f = 0; f < numFeatures; f++) {
      if (xi[f] !== 0) score += wc[f] * xi[f];
    }
    if (score > maxScore) {
      maxScore = score;
      bestClass = c;
    }
  }
  if (bestClass === y[i]) correct++;
}
const accuracy = (correct / X.length) * 100;
console.log(`Training complete! Model Accuracy on 5,000 Bank Muscat dataset reviews: ${accuracy.toFixed(2)}%`);

// Save model artifacts
fs.mkdirSync('src/ml', { recursive: true });
const modelData = {
  classes,
  vocabulary,
  idf,
  biases: Array.from(biases),
  weights: weights.map(w => Array.from(w)),
  trainedAt: new Date().toISOString(),
  datasetSize: parsed.data.length,
  accuracy: accuracy.toFixed(2),
  algorithm: 'TF-IDF Vectorizer + Multinomial Logistic Regression'
};

fs.writeFileSync('src/ml/trained_model.json', JSON.stringify(modelData));
console.log('Saved trained model to src/ml/trained_model.json');
