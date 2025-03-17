// Global variables
let currentPageId = 'login';
let currentUser = null;
let patients = [];
const API_URL = 'http://localhost:5000/api';

// Predefined users for demo
const users = {
    'admin': {
        fullname: 'Admin User',
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123'
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Show login page by default
    showPage('login');
    
    // Load patients from localStorage if available
    const savedPatients = localStorage.getItem('patients');
    if (savedPatients) {
        patients = JSON.parse(savedPatients);
    }
    
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showPage('patient-search');
    }
    
    // Add event listeners
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('patient-form').addEventListener('submit', handlePatientForm);
    
    // Add input validation
    addInputValidation();
});

// Add input validation to forms
function addInputValidation() {
    // Phone number validation
    const phoneInput = document.getElementById('patient-phone');
    phoneInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9+\-\s]/g, '');
    });
    
    // Age validation
    const ageInput = document.getElementById('patient-age');
    ageInput.addEventListener('input', function() {
        if (parseInt(this.value) < 0) this.value = 0;
        if (parseInt(this.value) > 120) this.value = 120;
    });
}

// Toggle sidebar visibility
function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
}

// Show a specific page
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        // Add fade-out animation
        page.classList.add('fade-out');
    });
    
    // Show the selected page
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        setTimeout(() => {
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('fade-out');
            });
            selectedPage.classList.add('active', 'fade-in');
            setTimeout(() => {
                selectedPage.classList.remove('fade-in');
            }, 300);
        }, 150);
    }
    
    currentPageId = pageId;
    
    // Update UI based on authentication state
    updateUserInterface();
}

// Update UI based on authentication state
function updateUserInterface() {
    const sidebar = document.getElementById('sidebar');
    const userInfo = document.getElementById('user-info');
    const menuBtn = document.getElementById('menu-btn');
    
    // Hide menu button on login and signup pages
    if (currentPageId === 'login' || currentPageId === 'signup') {
        sidebar.style.display = 'none';
        userInfo.style.display = 'none';
        menuBtn.style.display = 'none';
        return;
    }
    
    if (currentUser) {
        sidebar.style.display = 'block';
        userInfo.style.display = 'flex';
        menuBtn.style.display = 'block';
        document.getElementById('username-display').textContent = currentUser.username;
        
        // Update profile page
        const profileInfo = document.getElementById('profile-info');
        profileInfo.innerHTML = `
            <div class="profile-card">
                <div class="profile-header">
                    <i class="fas fa-user-circle profile-avatar"></i>
                    <h3>${currentUser.fullname}</h3>
                </div>
                <div class="profile-details">
                    <p><i class="fas fa-user"></i> <strong>Username:</strong> ${currentUser.username}</p>
                    <p><i class="fas fa-envelope"></i> <strong>Email:</strong> ${currentUser.email}</p>
                </div>
            </div>
        `;
    } else {
        sidebar.style.display = 'none';
        userInfo.style.display = 'none';
        menuBtn.style.display = 'none';
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const identifier = document.getElementById('login-identifier').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ identifier, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        // Save token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Set current user
        currentUser = data.user;
        
        // Show success message
        showAlert('Login successful!', 'success');
        
        // Update UI and show patient search page
        updateUserInterface();
        showPage('patient-search');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Handle signup form submission
async function handleSignup(e) {
    e.preventDefault();
    
    const fullname = document.getElementById('signup-fullname').value;
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    try {
        const response = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fullname, username, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Signup failed');
        }
        
        // Save token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Set current user
        currentUser = data.user;
        
        // Show success message
        showAlert('Account created successfully!', 'success');
        
        // Update UI and show patient search page
        updateUserInterface();
        showPage('patient-search');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Handle patient form submission
async function handlePatientForm(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showAlert('You must be logged in to add a patient!', 'error');
        return;
    }
    
    const patientId = document.getElementById('patient-id').value;
    const name = document.getElementById('patient-name').value;
    const age = document.getElementById('patient-age').value;
    const phone = document.getElementById('patient-phone').value;
    const gender = document.getElementById('patient-gender').value;
    const address = document.getElementById('patient-address').value;
    const medicalHistory = document.getElementById('medical-history').value;
    const currentMedications = document.getElementById('current-medications').value;
    const allergies = document.getElementById('allergies').value;
    
    const patientData = {
        patient_id: patientId,
        name,
        age,
        gender,
        phone,
        address,
        medical_history: medicalHistory,
        current_medications: currentMedications,
        allergies
    };
    
    try {
        const response = await fetch(`${API_URL}/patients`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(patientData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to save patient record');
        }
        
        // Show success message
        showAlert(data.message, 'success');
        
        // Reset form
        document.getElementById('patient-form').reset();
        
        // Show patient search page and refresh results
        showPage('patient-search');
        searchPatients();
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Generate a unique patient ID
function generatePatientId() {
    return 'P' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

// Search patients
async function searchPatients() {
    const searchInput = document.getElementById('search-input').value;
    const searchResults = document.getElementById('search-results');
    
    try {
        const url = searchInput 
            ? `${API_URL}/patients?search=${encodeURIComponent(searchInput)}`
            : `${API_URL}/patients`;
            
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch patients');
        }
        
        // Store patients data
        patients = data;
        
        // Display search results
        if (patients.length > 0) {
            searchResults.innerHTML = '';
            patients.forEach(patient => {
                searchResults.appendChild(createPatientCard(patient));
            });
        } else {
            searchResults.innerHTML = '<p class="no-results">No patients found matching your search.</p>';
        }
    } catch (error) {
        showAlert(error.message, 'error');
        searchResults.innerHTML = '<p class="no-results">Error fetching patients. Please try again.</p>';
    }
}

// Create patient card
function createPatientCard(patient) {
    const card = document.createElement('div');
    card.className = 'patient-card';
    
    card.innerHTML = `
        <div class="patient-card-header">
            <h3><i class="fas fa-user-injured"></i> ${patient.name}</h3>
            <span class="patient-id">ID: ${patient.id}</span>
        </div>
        <div class="patient-card-body">
            <p><i class="fas fa-birthday-cake"></i> <strong>Age:</strong> ${patient.age}</p>
            <p><i class="fas fa-phone"></i> <strong>Phone:</strong> ${patient.phone}</p>
            <p><i class="fas fa-venus-mars"></i> <strong>Gender:</strong> ${patient.gender}</p>
            <p><i class="fas fa-map-marker-alt"></i> <strong>Address:</strong> ${patient.address}</p>
            
            <div class="collapsible">
                <button class="collapsible-btn" onclick="toggleCollapsible(this)">
                    <i class="fas fa-notes-medical"></i> Medical Details <i class="fas fa-chevron-down"></i>
                </button>
                <div class="collapsible-content">
                    <p><strong>Medical History:</strong> ${patient.medical_history || 'None'}</p>
                    <p><strong>Current Medications:</strong> ${patient.current_medications || 'None'}</p>
                    <p><strong>Allergies:</strong> ${patient.allergies || 'None'}</p>
                </div>
            </div>
            
            <p class="updated-info">Last updated by ${patient.updated_by_name || patient.updated_by} on ${new Date(patient.last_updated).toLocaleString()}</p>
        </div>
        <div class="patient-card-footer">
            <button onclick="editPatient('${patient.id}')" class="edit-btn">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="deletePatient('${patient.id}')" class="delete-btn">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    return card;
}

// Toggle collapsible sections
function toggleCollapsible(button) {
    button.classList.toggle('active');
    const content = button.nextElementSibling;
    
    if (button.classList.contains('active')) {
        content.style.maxHeight = content.scrollHeight + 'px';
        button.querySelector('.fas.fa-chevron-down').classList.replace('fa-chevron-down', 'fa-chevron-up');
    } else {
        content.style.maxHeight = '0';
        button.querySelector('.fas.fa-chevron-up').classList.replace('fa-chevron-up', 'fa-chevron-down');
    }
}

// Edit patient
function editPatient(patientId) {
    const patient = patients.find(p => p.id === patientId);
    
    if (patient) {
        // Fill form with patient data
        document.getElementById('patient-id').value = patient.id;
        document.getElementById('patient-name').value = patient.name;
        document.getElementById('patient-age').value = patient.age;
        document.getElementById('patient-phone').value = patient.phone;
        document.getElementById('patient-gender').value = patient.gender;
        document.getElementById('patient-address').value = patient.address;
        document.getElementById('medical-history').value = patient.medical_history || '';
        document.getElementById('current-medications').value = patient.current_medications || '';
        document.getElementById('allergies').value = patient.allergies || '';
        
        // Show add patient page
        showPage('add-patient');
    }
}

// Delete patient
async function deletePatient(patientId) {
    if (confirm('Are you sure you want to delete this patient record?')) {
        try {
            const response = await fetch(`${API_URL}/patients/${patientId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete patient');
            }
            
            // Show success message
            showAlert(data.message, 'success');
            
            // Refresh search results
            searchPatients();
        } catch (error) {
            showAlert(error.message, 'error');
        }
    }
}

// Show alert message
function showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add alert to body
    document.body.appendChild(alert);
    
    // Show alert with animation
    setTimeout(() => {
        alert.classList.add('show');
    }, 10);
    
    // Remove alert after 3 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => {
            alert.remove();
        }, 300);
    }, 3000);
}

// Logout function
function logout() {
    // Clear user data
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    currentUser = null;
    
    // Show login page
    showPage('login');
    
    // Show success message
    showAlert('Logged out successfully!', 'success');
}

// Load initial data when patient search page is shown
document.addEventListener('click', function(e) {
    if (e.target.matches('a[onclick*="showPage(\'patient-search\')"]') || 
        (e.target.parentElement && e.target.parentElement.matches('a[onclick*="showPage(\'patient-search\')"]'))) {
        setTimeout(() => {
            if (currentPageId === 'patient-search') {
                searchPatients();
            }
        }, 300);
    }
}); 