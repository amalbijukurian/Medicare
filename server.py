from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
import bcrypt
import os
import jwt
from datetime import datetime, timedelta

# Skip loading environment variables
# from dotenv import load_dotenv
# load_dotenv()

app = Flask(__name__, static_folder='frontend')
CORS(app)

# Database configuration
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Amalbiju@20',  # Update with your actual MySQL password
    'database': 'medical_records'
}

# JWT configuration
JWT_SECRET_KEY = 'your_secret_key_here'
JWT_EXPIRATION_HOURS = 24

def get_db_connection():
    """Create and return a connection to the database"""
    try:
        print(f"Attempting to connect to MySQL with config: {db_config}")
        conn = mysql.connector.connect(**db_config)
        print("Database connection successful")
        return conn
    except mysql.connector.Error as err:
        print(f"Error connecting to MySQL: {err}")
        if err.errno == 1049:  # Unknown database
            print("Database does not exist. Attempting to create it...")
            try:
                # Connect without database specified
                temp_config = db_config.copy()
                temp_config.pop('database', None)
                temp_conn = mysql.connector.connect(**temp_config)
                temp_cursor = temp_conn.cursor()
                
                # Create the database
                temp_cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_config['database']}")
                temp_cursor.close()
                temp_conn.close()
                
                # Try connecting again
                print("Database created. Reconnecting...")
                conn = mysql.connector.connect(**db_config)
                print("Database connection successful after creating database")
                return conn
            except mysql.connector.Error as create_err:
                print(f"Failed to create database: {create_err}")
                return None
        return None

def execute_query(query, params=None, fetch=True):
    """Execute a query and return results if needed"""
    conn = get_db_connection()
    if not conn:
        raise Exception("Database connection failed")
        
    cursor = conn.cursor(dictionary=True)
    
    try:
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
            
        if fetch:
            result = cursor.fetchall()
        else:
            conn.commit()
            result = None
            
        return result
    except mysql.connector.Error as err:
        print(f"Error executing query: {err}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def init_db():
    """Initialize the database by creating tables if they don't exist"""
    print("Starting database initialization...")
    
    # Create database if it doesn't exist
    try:
        conn = mysql.connector.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password']
        )
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_config['database']}")
        cursor.close()
        conn.close()
        print(f"Database '{db_config['database']}' created or already exists")
    except mysql.connector.Error as err:
        print(f"Error creating database: {err}")
        return
    
    # Create users table
    users_table = """
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        fullname VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """
    execute_query(users_table, fetch=False)
    print("Users table created or already exists")
    
    # Create patients table
    patients_table = """
    CREATE TABLE IF NOT EXISTS patients (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL,
        gender VARCHAR(10) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        address TEXT NOT NULL,
        medical_history TEXT,
        current_medications TEXT,
        allergies TEXT,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by VARCHAR(255),
        FOREIGN KEY (updated_by) REFERENCES users(username)
    )
    """
    execute_query(patients_table, fetch=False)
    print("Patients table created or already exists")
    
    # Check if admin user exists
    admin_check = "SELECT * FROM users WHERE username = 'admin'"
    admin_exists = execute_query(admin_check)
    
    # Create admin user if it doesn't exist
    if not admin_exists:
        password = 'admin123'
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        admin_user = """
        INSERT INTO users (username, password, fullname, email) 
        VALUES (%s, %s, %s, %s)
        """
        execute_query(
            admin_user, 
            ('admin', hashed_password.decode('utf-8'), 'Administrator', 'admin@hospital.com'),
            fetch=False
        )
        print("Admin user created")
    else:
        print("Admin user already exists")
        
    print("Database initialization completed successfully!")

# Authentication decorator
def token_required(f):
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
            
        try:
            # Decode token
            data = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
            current_user = data['username']
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
            
        return f(current_user, *args, **kwargs)
    
    decorated.__name__ = f.__name__
    return decorated

# Serve static files
@app.route('/')
def serve_index():
    return send_from_directory('frontend', 'index.html')

# Authentication Routes
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('identifier') or not data.get('password'):
        return jsonify({'message': 'Missing login credentials!'}), 400
        
    identifier = data.get('identifier')
    password = data.get('password')
    
    # Check if identifier is username or email
    query = """
    SELECT * FROM users 
    WHERE username = %s OR email = %s
    """
    
    users = execute_query(query, (identifier, identifier))
    
    if not users:
        return jsonify({'message': 'Invalid username/email or password!'}), 401
        
    user = users[0]
    
    # Check password
    if not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        return jsonify({'message': 'Invalid username/email or password!'}), 401
    
    # Generate JWT token
    token = jwt.encode({
        'username': user['username'],
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }, JWT_SECRET_KEY)
    
    return jsonify({
        'token': token,
        'user': {
            'username': user['username'],
            'fullname': user['fullname'],
            'email': user['email']
        }
    })

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    
    required_fields = ['username', 'password', 'fullname', 'email']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'Missing required field: {field}!'}), 400
    
    username = data.get('username')
    password = data.get('password')
    fullname = data.get('fullname')
    email = data.get('email')
    
    # Check if username or email already exists
    check_query = """
    SELECT * FROM users 
    WHERE username = %s OR email = %s
    """
    
    existing_users = execute_query(check_query, (username, email))
    
    if existing_users:
        if existing_users[0]['username'] == username:
            return jsonify({'message': 'Username already exists!'}), 400
        else:
            return jsonify({'message': 'Email already exists!'}), 400
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    # Insert new user
    insert_query = """
    INSERT INTO users (username, password, fullname, email) 
    VALUES (%s, %s, %s, %s)
    """
    
    try:
        execute_query(insert_query, (username, hashed_password.decode('utf-8'), fullname, email), fetch=False)
    except Exception as e:
        return jsonify({'message': f'Error creating user: {str(e)}'}), 500
    
    # Generate JWT token
    token = jwt.encode({
        'username': username,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }, JWT_SECRET_KEY)
    
    return jsonify({
        'token': token,
        'user': {
            'username': username,
            'fullname': fullname,
            'email': email
        }
    })

# Patient Routes
@app.route('/api/patients', methods=['GET'])
@token_required
def get_patients(current_user):
    search = request.args.get('search', '')
    
    if search:
        search_pattern = f'%{search}%'
        query = """
        SELECT p.*, u.fullname as updated_by_name
        FROM patients p
        LEFT JOIN users u ON p.updated_by = u.username
        WHERE p.id LIKE %s OR p.name LIKE %s
        ORDER BY p.last_updated DESC
        """
        patients = execute_query(query, (search_pattern, search_pattern))
    else:
        query = """
        SELECT p.*, u.fullname as updated_by_name
        FROM patients p
        LEFT JOIN users u ON p.updated_by = u.username
        ORDER BY p.last_updated DESC
        """
        patients = execute_query(query)
    
    return jsonify(patients)

@app.route('/api/patients/<patient_id>', methods=['GET'])
@token_required
def get_patient(current_user, patient_id):
    query = """
    SELECT p.*, u.fullname as updated_by_name
    FROM patients p
    LEFT JOIN users u ON p.updated_by = u.username
    WHERE p.id = %s
    """
    
    patients = execute_query(query, (patient_id,))
    
    if not patients:
        return jsonify({'message': 'Patient not found!'}), 404
    
    return jsonify(patients[0])

@app.route('/api/patients', methods=['POST'])
@token_required
def add_or_update_patient(current_user):
    data = request.get_json()
    
    required_fields = ['name', 'age', 'gender', 'phone', 'address']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'Missing required field: {field}!'}), 400
    
    patient_id = data.get('patient_id')
    
    # If patient_id is provided, check if patient exists
    if patient_id:
        check_query = "SELECT * FROM patients WHERE id = %s"
        existing_patient = execute_query(check_query, (patient_id,))
        
        if existing_patient:
            # Update existing patient
            update_query = """
            UPDATE patients
            SET name = %s,
                age = %s,
                gender = %s,
                phone = %s,
                address = %s,
                medical_history = %s,
                current_medications = %s,
                allergies = %s,
                updated_by = %s
            WHERE id = %s
            """
            
            try:
                execute_query(
                    update_query, 
                    (
                        data.get('name'),
                        data.get('age'),
                        data.get('gender'),
                        data.get('phone'),
                        data.get('address'),
                        data.get('medical_history', ''),
                        data.get('current_medications', ''),
                        data.get('allergies', ''),
                        current_user,
                        patient_id
                    ),
                    fetch=False
                )
                
                return jsonify({'message': 'Patient updated successfully!', 'id': patient_id})
            except Exception as e:
                return jsonify({'message': f'Error updating patient: {str(e)}'}), 500
    
    # Generate new patient ID if not provided or patient doesn't exist
    if not patient_id:
        patient_id = 'P' + datetime.now().strftime('%Y%m%d%H%M%S')
    
    # Insert new patient
    insert_query = """
    INSERT INTO patients (id, name, age, gender, phone, address,
                         medical_history, current_medications, allergies, updated_by)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    try:
        execute_query(
            insert_query,
            (
                patient_id,
                data.get('name'),
                data.get('age'),
                data.get('gender'),
                data.get('phone'),
                data.get('address'),
                data.get('medical_history', ''),
                data.get('current_medications', ''),
                data.get('allergies', ''),
                current_user
            ),
            fetch=False
        )
        
        return jsonify({'message': 'Patient added successfully!', 'id': patient_id})
    except Exception as e:
        return jsonify({'message': f'Error adding patient: {str(e)}'}), 500

@app.route('/api/patients/<patient_id>', methods=['DELETE'])
@token_required
def delete_patient(current_user, patient_id):
    # Check if patient exists
    check_query = "SELECT * FROM patients WHERE id = %s"
    existing_patient = execute_query(check_query, (patient_id,))
    
    if not existing_patient:
        return jsonify({'message': 'Patient not found!'}), 404
    
    # Delete patient
    delete_query = "DELETE FROM patients WHERE id = %s"
    
    try:
        execute_query(delete_query, (patient_id,), fetch=False)
        return jsonify({'message': 'Patient deleted successfully!'})
    except Exception as e:
        return jsonify({'message': f'Error deleting patient: {str(e)}'}), 500

# User profile
@app.route('/api/user', methods=['GET'])
@token_required
def get_user_profile(current_user):
    query = "SELECT username, fullname, email FROM users WHERE username = %s"
    users = execute_query(query, (current_user,))
    
    if not users:
        return jsonify({'message': 'User not found!'}), 404
    
    return jsonify(users[0])

# Catch-all route to serve frontend files
@app.route('/<path:path>')
def serve_static(path):
    # First try to serve the file directly
    try:
        return send_from_directory('frontend', path)
    except:
        # If file not found, return index.html for client-side routing
        return send_from_directory('frontend', 'index.html')

if __name__ == '__main__':
    # Initialize database
    init_db()
    
    # Run the app
    app.run(debug=True, port=5000, load_dotenv=False) 