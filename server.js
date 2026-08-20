import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// In-memory shopping lists (for demo - would use database in production)
const userShoppingLists = {};

// Product database with categories and prices
const productDatabase = {
  'milk': { category: 'Dairy', price: 3.99, quantity: 1, variants: ['2% milk', 'whole milk', 'almond milk', 'oat milk'] },
  'bread': { category: 'Bakery', price: 2.50, quantity: 1, variants: ['whole wheat', 'white bread', 'sourdough'] },
  'apples': { category: 'Produce', price: 4.99, quantity: 1, variants: ['red apples', 'green apples', 'golden apples'] },
  'bananas': { category: 'Produce', price: 0.59, quantity: 1, variants: ['ripe bananas', 'green bananas'] },
  'chicken': { category: 'Meat', price: 8.99, quantity: 1, variants: ['chicken breast', 'whole chicken', 'chicken thighs'] },
  'eggs': { category: 'Dairy', price: 4.50, quantity: 12, variants: ['brown eggs', 'white eggs', 'free-range'] },
  'cheese': { category: 'Dairy', price: 6.99, quantity: 1, variants: ['cheddar', 'mozzarella', 'feta'] },
  'water': { category: 'Beverages', price: 5.99, quantity: 6, variants: ['bottled water', 'sparkling water'] },
  'toothpaste': { category: 'Personal Care', price: 3.99, quantity: 1, variants: ['mint', 'whitening', 'sensitivity'] },
  'rice': { category: 'Pantry', price: 2.99, quantity: 1, variants: ['white rice', 'brown rice', 'jasmine rice'] },
  'pasta': { category: 'Pantry', price: 1.99, quantity: 1, variants: ['spaghetti', 'penne', 'fettuccine'] },
  'tomato sauce': { category: 'Pantry', price: 1.99, quantity: 1, variants: ['marinara', 'arrabbiata'] },
  'olive oil': { category: 'Pantry', price: 12.99, quantity: 1, variants: ['extra virgin', 'virgin'] },
  'yogurt': { category: 'Dairy', price: 5.99, quantity: 6, variants: ['plain', 'strawberry', 'greek yogurt'] },
  'oranges': { category: 'Produce', price: 5.99, quantity: 1, variants: ['valencia oranges', 'navel oranges'] }
};

// Seasonal recommendations
const seasonalItems = {
  'spring': ['strawberries', 'asparagus', 'peas', 'artichokes'],
  'summer': ['watermelon', 'corn', 'zucchini', 'tomatoes', 'berries'],
  'fall': ['apples', 'pumpkin', 'squash', 'grapes'],
  'winter': ['kale', 'carrots', 'potatoes', 'citrus fruits', 'broccoli']
};

// Substitution suggestions
const substitutes = {
  'milk': ['almond milk', 'oat milk', 'soy milk', 'coconut milk'],
  'eggs': ['flax eggs', 'applesauce', 'mashed bananas'],
  'butter': ['coconut oil', 'olive oil', 'avocado'],
  'sugar': ['honey', 'maple syrup', 'stevia'],
  'bread': ['rice cakes', 'wraps', 'pita bread']
};

// NLP Engine for voice command processing
class VoiceCommandProcessor {
  constructor() {
    this.keywords = {
      add: ['add', 'need', 'get', 'buy', 'i want', 'i need', 'put', 'include'],
      remove: ['remove', 'delete', 'take out', 'don\'t need', 'stop', 'remove from', 'scratch'],
      quantity: ['bottles', 'cartons', 'boxes', 'packs', 'cans', 'jars', 'pounds', 'kg'],
      search: ['find', 'search', 'look for', 'show me'],
      list: ['show', 'list', 'what\'s', 'what is', 'tell me', 'display']
    };
  }

  processCommand(command) {
    const lowerCommand = command.toLowerCase();
    let action = 'unknown';
    let item = '';
    let quantity = 1;
    let details = {};

    // Determine action
    if (this.keywords.add.some(keyword => lowerCommand.includes(keyword))) {
      action = 'add';
    } else if (this.keywords.remove.some(keyword => lowerCommand.includes(keyword))) {
      action = 'remove';
    } else if (this.keywords.search.some(keyword => lowerCommand.includes(keyword))) {
      action = 'search';
    } else if (this.keywords.list.some(keyword => lowerCommand.includes(keyword))) {
      action = 'list';
    }

    // Extract item name
    const words = lowerCommand.split(' ');
    const meaningfulWords = words.filter(w => w.length > 2 && !this.keywords.add.includes(w) && !this.keywords.remove.includes(w));
    item = meaningfulWords.join(' ');

    // Extract quantity if present
    const quantityMatch = lowerCommand.match(/(\d+)\s*(bottles|cartons|boxes|packs|cans|jars|pounds|kg|oz|ml)?/i);
    if (quantityMatch) {
      quantity = parseInt(quantityMatch[1]) || 1;
    }

    return {
      action,
      item: item.trim(),
      quantity,
      originalCommand: command
    };
  }

  findClosestMatch(item) {
    const lowerItem = item.toLowerCase();
    
    // Exact match
    if (productDatabase[lowerItem]) {
      return lowerItem;
    }

    // Partial match
    for (const product in productDatabase) {
      if (product.includes(lowerItem) || lowerItem.includes(product)) {
        return product;
      }
    }

    // Similarity check (Levenshtein-like simple approach)
    let bestMatch = null;
    let bestScore = 0;
    for (const product in productDatabase) {
      const score = this.calculateSimilarity(lowerItem, product);
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = product;
      }
    }

    return bestMatch;
  }

  calculateSimilarity(a, b) {
    const minLen = Math.min(a.length, b.length);
    let matches = 0;
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) matches++;
    }
    return matches / Math.max(a.length, b.length);
  }
}

const processor = new VoiceCommandProcessor();

// API Routes

// Process voice command
app.post('/api/process-command', (req, res) => {
  try {
    const { command, userId } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const processedCommand = processor.processCommand(command);
    let response = {
      success: false,
      action: processedCommand.action,
      message: '',
      data: null
    };

    if (!userShoppingLists[userId]) {
      userShoppingLists[userId] = [];
    }

    const currentList = userShoppingLists[userId];

    switch (processedCommand.action) {
      case 'add': {
        const matchedProduct = processor.findClosestMatch(processedCommand.item);
        if (matchedProduct) {
          const existingItem = currentList.find(item => item.name === matchedProduct);
          if (existingItem) {
            existingItem.quantity += processedCommand.quantity;
            response.message = `Updated ${matchedProduct} quantity to ${existingItem.quantity}`;
          } else {
            currentList.push({
              name: matchedProduct,
              quantity: processedCommand.quantity,
              category: productDatabase[matchedProduct].category,
              price: productDatabase[matchedProduct].price,
              addedAt: new Date()
            });
            response.message = `Added ${processedCommand.quantity} ${matchedProduct} to your shopping list`;
          }
          response.success = true;
        } else {
          response.message = `Sorry, I couldn't find ${processedCommand.item}. Please be more specific.`;
        }
        break;
      }

      case 'remove': {
        const itemIndex = currentList.findIndex(item => 
          item.name.toLowerCase().includes(processedCommand.item.toLowerCase())
        );
        if (itemIndex !== -1) {
          const removed = currentList.splice(itemIndex, 1)[0];
          response.message = `Removed ${removed.name} from your shopping list`;
          response.success = true;
        } else {
          response.message = `${processedCommand.item} not found in your shopping list`;
        }
        break;
      }

      case 'search': {
        const matchedProduct = processor.findClosestMatch(processedCommand.item);
        if (matchedProduct && productDatabase[matchedProduct]) {
          const product = productDatabase[matchedProduct];
          response.message = `Found ${matchedProduct}: $${product.price.toFixed(2)}, Category: ${product.category}`;
          response.data = { product: matchedProduct, ...product };
          response.success = true;
        } else {
          response.message = `Could not find ${processedCommand.item}`;
        }
        break;
      }

      case 'list': {
        response.message = currentList.length > 0 ? 'Here is your current shopping list' : 'Your shopping list is empty';
        response.data = { items: currentList, total: currentList.length };
        response.success = true;
        break;
      }

      default:
        response.message = 'Could not understand the command';
    }

    res.json(response);
  } catch (error) {
    console.error('Error processing command:', error);
    res.status(500).json({ error: 'Error processing command', details: error.message });
  }
});

// Get shopping list
app.get('/api/shopping-list/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const list = userShoppingLists[userId] || [];
    const total = list.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({
      items: list,
      count: list.length,
      total: total.toFixed(2),
      groupedByCategory: groupByCategory(list)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching list', details: error.message });
  }
});

// Get smart suggestions
app.post('/api/suggestions', (req, res) => {
  try {
    const { userId } = req.body;
    const currentList = userShoppingLists[userId] || [];
    const suggestions = [];

    // Complementary items
    const complementaryItems = {
      'milk': ['cereal', 'bread', 'cheese'],
      'bread': ['butter', 'jam', 'cheese'],
      'eggs': ['bread', 'butter', 'cheese'],
      'pasta': ['tomato sauce', 'olive oil', 'cheese'],
      'chicken': ['olive oil', 'rice', 'tomato sauce']
    };

    for (const item of currentList) {
      if (complementaryItems[item.name]) {
        suggestions.push(...complementaryItems[item.name]);
      }
    }

    // Seasonal suggestions
    const season = getCurrentSeason();
    const seasonalSuggestions = seasonalItems[season] || [];

    res.json({
      complementary: [...new Set(suggestions)],
      seasonal: seasonalSuggestions,
      substitutes: getSubstitutesForList(currentList)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error generating suggestions', details: error.message });
  }
});

// Get product search results
app.get('/api/search/:query', (req, res) => {
  try {
    const { query } = req.params;
    const results = [];

    for (const product in productDatabase) {
      if (product.includes(query.toLowerCase())) {
        results.push({
          name: product,
          ...productDatabase[product]
        });
      }
    }

    res.json({ results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: 'Error searching products', details: error.message });
  }
});

// Clear shopping list
app.delete('/api/shopping-list/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    userShoppingLists[userId] = [];
    res.json({ success: true, message: 'Shopping list cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Error clearing list', details: error.message });
  }
});

// Helper functions
function groupByCategory(items) {
  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push(item);
  });
  return grouped;
}

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

function getSubstitutesForList(items) {
  const result = {};
  items.forEach(item => {
    if (substitutes[item.name]) {
      result[item.name] = substitutes[item.name];
    }
  });
  return result;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Voice Shopping Assistant API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎤 Voice Shopping Assistant Backend running on http://localhost:${PORT}`);
  console.log(`📋 API Documentation available at http://localhost:${PORT}`);
});
