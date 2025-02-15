const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // For password hashing
const path = require('path'); // Used for resolving paths

const app = express();
const PORT = process.env.PORT || 5000;

require('dotenv').config();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("Connected to MongoDB successfully"))
.catch(err => console.error("Error connecting to MongoDB:", err));


// Serve static files (HTML, CSS, JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for the root route (main page)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route schema
const routeSchema = new mongoose.Schema({
  coordinates: [[Number]],  // Array of coordinate arrays [lat, lng]
  color: String,            // Route color
  borderColor: String,      // Route border color
  timestamp: Date,          // Route creation timestamp
  message: String,           // Route message
  username: String
});

const Route = mongoose.model('Route', routeSchema);

// User schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// POST route to handle signup
app.post('/api/signup', async (req, res) => {
  const { email, username, password } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10); 
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ email, username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'User created successfully!', user: newUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST route to handle login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Compare the entered password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    res.status(200).json({ message: 'Login successful!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST route to save route data
app.post('/api/routes', async (req, res) => {
  const { coordinates, color, borderColor, timestamp, message, username } = req.body;
  const newRoute = new Route({ coordinates, color, borderColor, timestamp, message, username });
  try {
    await newRoute.save();
    res.status(201).json(newRoute);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET route to fetch all saved routes
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find();
    res.status(200).json(routes);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET route to fetch Mapbox API key
app.get('/api/mapbox-key', (req, res) => {
  res.json({ apiKey: process.env.MAPBOX_KEY });
});

// GET route to fetch Thunderforest API key
app.get('/api/thunderforest-key', (req, res) => {
  res.json({ apiKey: process.env.THUNDERFOREST_KEY });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
