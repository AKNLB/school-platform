from flask import Flask, request, jsonify

app = Flask(__name__)

# Sample in-memory “database” for demonstration
users = {
    "admin": {"password": "adminpass", "role": "admin"},
    "teacher1": {"password": "teachpass", "role": "teacher"}
}

# Example endpoint: login/authentication
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    user = users.get(username)
    if user and user['password'] == password:
        # A real-world app would generate a secure session or token here
        return jsonify({"message": "Login successful", "role": user["role"]})
    return jsonify({"message": "Invalid credentials"}), 401

# Example endpoint: get announcements
@app.route('/api/announcements', methods=['GET'])
def get_announcements():
    announcements = [
        {"id": 1, "title": "Staff Meeting", "description": "Meeting at 10 AM."},
        {"id": 2, "title": "Holiday Notice", "description": "School closed on Friday."}
    ]
    return jsonify(announcements)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
