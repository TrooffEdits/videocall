from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
users = {}

@app.route("/")
def index():
    return render_template("index.html")

@socketio.on("join")
def on_join(data):
    users[data["user"]] = request.sid
    emit("ready", room=request.sid)

@socketio.on("signal")
def on_signal(data):
    target_sid = users.get(data["target"])
    if target_sid:
        emit("signal", data["signal"], room=target_sid)

if __name__ == "__main__":
    socketio.run(app, port=5000)
