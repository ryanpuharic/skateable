// Fallback map center if geolocation fails or is not supported
let mapboxApiKey = ''

let defaultMapOptions = {
    center: [40.2137, -74.3001],  // Example fallback center point (Germany)
    zoom: 15
};

let loggedInUser = '';
let currentMode = 'view';  // Default mode

// Initialize the map without centering yet
let map = L.map('map');

// Load and add the tile layer (OpenStreetMap) to the map
let layer = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
map.addLayer(layer);

function fetchMapboxApiKey() {
    return fetch('/api/mapbox-key')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            mapboxApiKey = data.apiKey; // Store the API key in a variable
            console.log('Mapbox API key fetched successfully:', mapboxApiKey);
        })
        .catch(error => {
            console.error('Error fetching Mapbox API key:', error);
            throw error; // Rethrow to handle it later if needed
        });
}

fetchMapboxApiKey()
    .then(() => {
        // Now that the API key is fetched, you can safely call addTemporaryRoute
        // Example: addTemporaryRoute([startLat, startLng], [endLat, endLng]);
    })
    .catch(error => {
        console.error('Failed to fetch the Mapbox API key:', error);
        // Handle error appropriately (e.g., disable route drawing functionality)
    });

// Try to get the user's location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        function(position) {
            // On success, use the user's location as the map center
            const userCoords = [position.coords.latitude, position.coords.longitude];
            map.setView(userCoords, 15); 
        },
        function() {
            // On failure (e.g., user denies location access), use the default center
            map.setView(defaultMapOptions.center, defaultMapOptions.zoom);
        }
    );
} else {
    // If geolocation is not supported, use the default center
    map.setView(defaultMapOptions.center, defaultMapOptions.zoom);
}

// Existing map initialization and other code

// Function to search location using OpenStreetMap's Nominatim API
function searchLocation(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                // Get the first result's coordinates (latitude and longitude)
                const { lat, lon } = data[0];
                // Set the map view to the searched location
                map.setView([lat, lon], 15); // Adjust zoom level if needed
            } else {
                alert("Location not found.");
            }
        })
        .catch(error => {
            console.error('Error fetching location data:', error);
            alert("Error searching for location.");
        });
}

// Attach event listener to the search button
document.getElementById('search-button').addEventListener('click', function() {
    const query = document.getElementById('search-input').value;
    if (query) {
        searchLocation(query);
    } else {
        alert("Please enter a location.");
    }
});

// Also allow pressing 'Enter' to trigger the search
document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const query = document.getElementById('search-input').value;
        if (query) {
            searchLocation(query);
        } else {
            alert("Please enter a location.");
        }
    }
});

// Routing layer where the user-created roads will appear temporarily
let temporaryRoute = null;
let routeData = null;  // Store route data after it's calculated

// Layer group to store confirmed routes permanently
let permanentRoutes = L.layerGroup().addTo(map);

// Button to confirm the route
let confirmRouteButton = document.getElementById('confirm-route');

// Dropdowns for route color and border color selection
let routeColorSelector = document.getElementById('route-color');
let routeBorderColorSelector = document.getElementById('route-border-color');

// Text area for the optional route message
let routeMessageInput = document.getElementById('route-message');

// Function to add a route that snaps to the roads
function addTemporaryRoute(startPoint, endPoint) {
    // Remove any existing temporary route
    if (temporaryRoute) {
        map.removeControl(temporaryRoute);
    }

    // Custom routing plan to disable markers
    const customPlan = L.Routing.plan([L.latLng(startPoint), L.latLng(endPoint)], {
        createMarker: function() { return null; },  // Disable markers
        addWaypoints: false  // Disable waypoint dragging
    });

    // Create a new routing control using Mapbox, explicitly disabling the itinerary
    temporaryRoute = L.Routing.control({
        plan: customPlan,
        router: L.Routing.mapbox(mapboxApiKey, {
            profile: 'mapbox/walking'  // Change to 'mapbox/driving', 'mapbox/cycling' for other profiles
        }),
        lineOptions: {
            styles: [
                { color: routeBorderColorSelector.value, weight: 13 },  // Border layer
                { color: routeColorSelector.value, weight: 5 }  // Main route layer
            ]
        },
        fitSelectedRoutes: true,
        routeWhileDragging: false,
        itinerary: null,  // Explicitly disable the itinerary (directions box)
        show: false,  // Another layer to ensure the box is hidden
    }).addTo(map);

    // Add an event listener to enable the confirm button after the route is calculated
    temporaryRoute.on('routesfound', function(e) {
        routeData = e.routes[0];  // Store the route data once the route is found
        confirmRouteButton.disabled = false;  // Enable the confirm button once a route is created
    });
}

// Create polyline with clickable segments
function addClickableRoute(coordinates, route) {
    for (let i = 0; i < coordinates.length - 1; i++) {
        let segmentCoordinates = [coordinates[i], coordinates[i + 1]];

        // Create a polyline for each segment
        let segment = L.polyline(segmentCoordinates, {
            color: route.borderColor,
            weight: 13,
            zIndex: 1
        }).addTo(permanentRoutes);

        // Create a thinner polyline for the main line
        let mainSegment = L.polyline(segmentCoordinates, {
            color: route.color,
            weight: 5,
            zIndex: 2
        }).addTo(permanentRoutes);

        // Add a click event to show the popup for each segment
        segment.on('click', function(e) {
            L.popup()
             .setLatLng(e.latlng)
             .setContent(`<b>Message:</b> ${route.message}<br><b>User:</b> ${route.username}<br><b>Timestamp:</b> ${new Date(route.timestamp).toLocaleString()}`)
             .openOn(map);
        });

        mainSegment.on('click', function(e) {
            L.popup()
             .setLatLng(e.latlng)
             .setContent(`<b>Message:</b> ${route.message}<br><b>User:</b> ${route.username}<br><b>Timestamp:</b> ${new Date(route.timestamp).toLocaleString()}`)
             .openOn(map);
        });
    }
}

// Function to update the temporary route color dynamically
function updateTemporaryRouteStyle() {
    if (temporaryRoute) {
        // Update the line style for the existing temporary route
        temporaryRoute.getPlan().setLineOptions({
            styles: [
                { color: routeBorderColorSelector.value, weight: 13 },  // Update the border color
                { color: routeColorSelector.value, weight: 5 }  // Update the main line color
            ]
        });
    }
}

// Store the route permanently by adding it to the map as a polyline
function confirmRoute() {
    if (routeData) {
        const timestamp = new Date();
        const routeMessage = routeMessageInput.value || "";  // Use a default message if none is entered
        const coordinates = routeData.coordinates.map(coord => [coord.lat, coord.lng]);

        // Create polyline for visualization, as before...

        // Send route data to backend for saving
        const routeDetails = {
            coordinates: coordinates,
            color: routeColorSelector.value,
            borderColor: routeBorderColorSelector.value,
            timestamp: timestamp,
            message: routeMessage,
            username: loggedInUser
        };

        fetch('http://localhost:5000/api/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(routeDetails)
        })
        .then(response => response.json())
        .then(data => console.log('Route saved.'))
        .catch(error => console.error('Error saving route:', error));

        L.polyline(coordinates, {
            color: routeBorderColorSelector.value,  // Border color
            weight: 13,  // Thicker border
            zIndex: 1   // Ensure the border is drawn beneath the main line
        }).addTo(permanentRoutes);  // Add to permanent routes layer

        // Create a polyline for the main line color with a smaller weight and higher zIndex
        const routeLine = L.polyline(coordinates, {
            color: routeColorSelector.value,  // Main color
            weight: 5,  // Thinner main line
            zIndex: 2   // Ensure the main line is drawn on top
        }).addTo(permanentRoutes);  // Add to permanent routes layer
        
        // Attach route details to the polyline for easy access in view mode
        routeLine.routeDetails = {
            message: routeMessage,
            timestamp: timestamp,
            username: loggedInUser
        };        

        // Log the timestamp and message associated with the route

        // Remove the temporary routing control and reset the button and message input
        map.removeControl(temporaryRoute);
        temporaryRoute = null;
        routeData = null;  // Clear route data
        confirmRouteButton.disabled = true;

        // Clear the text area after confirming the route
        routeMessageInput.value = '';
    }
}

// Handle clicks on the map to set waypoints for the route
let waypoints = [];
map.on('click', function(e) {
    if (currentMode === 'draw') {
        waypoints.push([e.latlng.lat, e.latlng.lng]);

        // If two waypoints are clicked, create the temporary route
        if (waypoints.length === 2) {
            addTemporaryRoute(waypoints[0], waypoints[1]);
            waypoints = [];  // Reset waypoints array for the next route
        }
    } else if (currentMode === 'view') {
        // In view mode, we need to find if a route was clicked
        let clickedRoute = null;

        permanentRoutes.eachLayer(function(layer) {
            if (layer instanceof L.Polyline) {
                // Check if the clicked point is near a route
                const latLngs = layer.getLatLngs();
                latLngs.forEach(function(latLng) {
                    if (map.distance(e.latlng, latLng) < 10) {  // Adjust distance tolerance as needed
                        clickedRoute = layer;
                    }
                });
            }
        });

        if (clickedRoute) {
            // Show popup with timestamp and message if available
            const routeDetails = clickedRoute.routeDetails || {};  // Store details in the layer when creating it
            const message = routeDetails.message || '';
            const username = routeDetails.username || '';
            const timestamp = routeDetails.timestamp ? new Date(routeDetails.timestamp).toLocaleString() : 'No timestamp';
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`<strong>Message:</strong> ${message}<br><strong>User:</strong> ${username}<br><strong>Timestamp:</strong> ${timestamp}`)
                .openOn(map);
        }
    }
});




//Event listener for mode toggle
const modeToggle = document.getElementById('mode-toggle');
modeToggle.addEventListener('change', function() {
    currentMode = modeToggle.value;
});


// Event listener for the confirm button
confirmRouteButton.addEventListener('click', confirmRoute);

// Event listeners for color selection changes
routeColorSelector.addEventListener('change', updateTemporaryRouteStyle);
routeBorderColorSelector.addEventListener('change', updateTemporaryRouteStyle);

window.onload = function() {
    // Fetch existing routes from the backend and add them to the map
    fetch('http://localhost:5000/api/routes')
        .then(response => response.json())
        .then(routes => {
            routes.forEach(route => {
                const coordinates = route.coordinates;
                addClickableRoute(coordinates, route);

                // Create polyline for the border (outline)
                L.polyline(coordinates, {
                    color: route.borderColor,
                    weight: 13,
                    zIndex: 1
                }).addTo(permanentRoutes);

                // Create polyline for the main line
                const routeLine = L.polyline(coordinates, {
                    color: route.color,
                    weight: 5,
                    zIndex: 2
                }).addTo(permanentRoutes);

                // Attach details to each route
                routeLine.routeDetails = {
                    message: route.message,
                    timestamp: route.timestamp,
                    username: route.username
                };
            });
        })
        .catch(error => console.error('Error loading routes:', error));

    // DOM Elements for login/logout functionality
    const loginButton = document.getElementById('login-btn');
    const signUpMainButton = document.getElementById('sign-up-main-btn'); // New Sign-Up Button
    const loginSection = document.getElementById('login-section');
    const loginModal = document.getElementById('login-modal');
    const closeModal = document.querySelector('.close');
    const loginForm = document.getElementById('login-form');
    const toggleSignUpButton = document.getElementById('toggle-sign-up-btn');
    const emailField = document.getElementById('email-field'); // New Email Field
    const modalTitle = document.getElementById('modal-title'); // Modal title
    const submitButton = document.getElementById('submit-btn'); // Submit button
    const toggleFormText = document.getElementById('toggle-form-text');
    const logoutButton = document.getElementById('logout-btn');
    const userControls = document.getElementById('user-controls');

    // Initially, the email field is hidden (only shown in sign-up mode)
    emailField.style.display = 'none';
    userControls.style.display = 'none';
    logoutButton.style.display = 'none';

    // Show the login modal when clicking the login button
    loginButton.addEventListener('click', function() {
        modalTitle.textContent = 'login'; // Set the title to "Login"
        submitButton.textContent = 'login'; // Set the button text to "Login"
        emailField.style.display = 'none'; // Hide the email field in login mode
        toggleFormText.innerHTML = 'don\'t have an account? <button id="toggle-sign-up-btn">sign up</button>';
        loginModal.style.display = 'block'; // Show the modal
    });

    // Show the sign-up modal when clicking the sign-up button
    signUpMainButton.addEventListener('click', function() {
        modalTitle.textContent = 'sign up'; // Set the title to "Sign Up"
        submitButton.textContent = 'sign up'; // Set the button text to "Sign Up"
        emailField.style.display = 'block'; // Show the email field in sign-up mode
        toggleFormText.innerHTML = 'already have an account? <button id="toggle-sign-up-btn">login</button>';
        loginModal.style.display = 'block'; // Show the modal
    });

    // Close modal event
    closeModal.addEventListener('click', function() {
        loginModal.style.display = 'none';
    });

    // Close modal when clicking outside the modal content
    window.addEventListener('click', function(event) {
        if (event.target == loginModal) {
            loginModal.style.display = 'none';
        }
    });

    // Toggle between login and sign-up forms
    document.addEventListener('click', function(event) {
        if (event.target && event.target.id === 'toggle-sign-up-btn') {
            if (submitButton.textContent === 'login') {
                modalTitle.textContent = 'sign up'; // Change to sign-up
                submitButton.textContent = 'sign up'; // Change button text
                emailField.style.display = 'block'; // Show email field
                toggleFormText.innerHTML = 'already have an account? <button id="toggle-sign-up-btn">login</button>';
            } else {
                modalTitle.textContent = 'login'; // Change to login
                submitButton.textContent = 'login'; // Change button text
                emailField.style.display = 'none'; // Hide email field
                toggleFormText.innerHTML = 'don\'t have an account? <button id="toggle-sign-up-btn">sign up</button>';
            }
        }
    });

    // Handle form submission for both login and sign-up
    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();
    
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const email = document.getElementById('email').value; // Optional email field
    
        if (submitButton.textContent === 'login') {
            // Login logic
            if (username && password) {
                // Data being sent to the server
                const loginData = {
                    username: username,
                    password: password
                };

    
                // Send API request to login
                fetch('http://localhost:5000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loginData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                    } else {
                        // Successful login logic
                        loggedInUser = username;
                        loginModal.style.display = 'none';
                        loginButton.style.display = 'none';
                        signUpMainButton.style.display = 'none';
                        loginSection.style.display = 'none';
                        logoutButton.style.display = 'block'; 
                        userControls.style.display = 'block';

                        document.getElementById('logged-in-user').textContent = loggedInUser;
                    }
                })
                .catch(error => console.error('Error during login:', error));
            } else {
                alert('Please enter both username and password.');
            }
        } else {
            // Sign-up logic (already implemented)
            if (username && password && email) {
                const userData = {
                    email: email,
                    username: username,
                    password: password
                };
    
                fetch('http://localhost:5000/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                    } else {
                        // Successful signup logic
                        loginModal.style.display = 'none';
                        loginSection.style.display = 'block'; // Show login button again
                        loginButton.style.display = 'block'; // Show login button again
                        signUpMainButton.style.display = 'none';

                        logoutButton.style.display = 'none'; 
                        userControls.style.display = 'none';
                    }
                })
                .catch(error => console.error('Error during signup:', error));
            } else {
                alert('Please fill in all fields (username, password, and email).');
            }
        }
    });
    

    logoutButton.addEventListener('click', function() {
        // Hide user controls and show the login button
        userControls.style.display = 'none'; // Hide controls
        logoutButton.style.display = 'none'; // Hide logout button
        loginSection.style.display = 'block'; // Show login button again
        loginButton.style.display = 'block'; // Show login button again

        document.getElementById('logged-in-user').textContent = 'guest';
    });

};


// Minimize button functionality
$(document).ready(function() {
    $('#toggle-button').click(function() {
        if ($('#text-container').is(':visible')) {
            $('#text-container').slideUp('fast');
            $(this).text('+');
        } else {
            $('#text-container').slideDown('fast');
            $(this).text('-');
        }
    });
});
