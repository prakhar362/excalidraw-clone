# SketchCalibur 🎨

A real-time collaborative whiteboard application that enables teams to visualize ideas together, featuring unlimited themed rooms, live cursor tracking, and AI-powered diagram generation.

![SketchCalibur Demo](https://img.shields.io/badge/Users-100%2B-brightgreen) ![Retention](https://img.shields.io/badge/Retention-70%25%2B-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### 🖌️ Real-Time Collaboration
- **100+ Concurrent Users**: Seamlessly collaborate with large teams without performance degradation
- **Live Cursor Tracking**: See exactly where your teammates are working with WebSocket-based real-time cursor movements
- **Instant Synchronization**: All drawing actions are synchronized across users in milliseconds

### 🎨 Powerful Drawing Canvas
- **Excalidraw Integration**: Leverages the robust Excalidraw library for a feature-rich drawing experience
- **Multiple Drawing Tools**: Shapes, freehand drawing, text, arrows, and more
- **Infinite Canvas**: Unlimited space for your creative ideas
- **Themed Rooms**: Customize each room with different visual themes

### 🏠 Room Management
- **Unlimited Rooms**: Create as many collaborative spaces as you need
- **Secure Room Creation**: Protected room generation with unique identifiers
- **Easy Sharing**: Share room links with your team for instant collaboration
- **Persistent Sessions**: All work is automatically saved

### 💬 Built-in Communication
- **Dedicated Group Chat**: Each canvas room includes its own chat feature
- **Team Coordination**: Discuss ideas while sketching together in real-time

### 🤖 AI-Powered Features (NEW!)
- **Intelligent Intent Detection**: Automatically classifies sketches (artistic, math, handwriting, diagrams)
- **Sketch Enhancement**: Transforms rough sketches into professional-looking drawings using CV techniques
- **Math Equation Solver**: Recognizes handwritten equations and provides step-by-step solutions
- **Handwriting Recognition**: Converts handwritten text to clean, editable text using Microsoft TrOCR
- **Text-to-Diagram**: Generate diagrams automatically from text prompts
- **Smart Vectorization**: Converts raster images to Excalidraw vector elements
- **Real-Time Processing**: CPU-optimized ML models for fast inference

### 📱 Responsive Design
- **Mobile-Friendly UI**: Fully responsive interface works on desktop, tablet, and mobile
- **Touch Optimized**: Native touch support for tablets and mobile devices
- **Cross-Platform**: Works seamlessly across all modern browsers

## 🏗️ Tech Stack

### Frontend
- **React 18+** with TypeScript
- **Next.js 15** for SSR and routing
- **Excalidraw** library for canvas
- **Tailwind CSS** for styling
- **Axios** for API calls

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **WebSocket (ws)** for real-time communication
- **MongoDB** for data persistence
- **JWT** for authentication

### ML Backend (NEW!)
- **FastAPI** for high-performance API
- **PyTorch** for deep learning
- **Transformers** (HuggingFace) for pre-trained models
- **OpenCV** for computer vision
- **SymPy** for symbolic mathematics
- **Microsoft TrOCR** for handwriting recognition
- **Google ViT** for image classification

### Infrastructure
- **Docker** & Docker Compose for containerization
- **Vercel** for frontend deployment
- **Render** for backend deployment
- **Redis** for caching (optional)

## 📖 Usage

### Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd sketchcalibur

# Start all services with Docker
docker-compose up --build

# Or use the quick start script
# On Windows:
start-ml-system.bat
# On macOS/Linux:
./start-ml-system.sh
```

Services will be available at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **ML Backend**: http://localhost:8000

### Creating a Room

1. Click "Create New Room" on the homepage
2. Choose a theme (optional)
3. Share the generated room link with your team

### Joining a Room

1. Click on a shared room link
2. Start collaborating immediately
3. See live cursors of all participants

### Using AI Enhancement

1. **Draw something** on the canvas (sketch, math equation, or handwriting)
2. **Select the elements** you want to enhance
3. **Click the AI Enhancement button** in the toolbar (top-right)
4. **Choose enhancement type**:
   - **Auto Enhance**: Automatically detects intent and processes
   - **Sketch**: Enhance artistic drawings
   - **Math**: Solve mathematical equations
   - **Text**: Convert handwriting to text
   - **Detect**: Just classify without processing
5. **Wait for processing** (first request takes ~30s, subsequent requests <2s)
6. **Enhanced result appears** on the canvas

### Using AI Diagram Generation

1. Click the "AI Diagram" button in the toolbar
2. Enter a text description (e.g., "Create a user authentication flow diagram")
3. The AI will generate the diagram on your canvas

### Group Chat

1. Click the chat icon in the room
2. Send messages to all room participants
3. Chat history is preserved during the session

## 🎯 Key Metrics

- **100+ Simultaneous Users**: Tested and optimized for large team collaboration
- **70%+ Retention Rate**: High user satisfaction among beta testers
- **Real-Time Performance**: <100ms latency for cursor and drawing updates
- **Mobile Responsive**: 100% feature parity across devices
- **ML Processing**: <2s average for AI enhancements (after warm-up)
- **Intent Accuracy**: 85%+ classification accuracy with heuristic refinement


## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- [Excalidraw](https://excalidraw.com/) for the amazing drawing library
- [HuggingFace](https://huggingface.co/) for pre-trained ML models
- [Microsoft](https://www.microsoft.com/) for TrOCR model
- [Google](https://www.google.com/) for Vision Transformer
- The open-source community for inspiration and tools
- All beta testers who provided valuable feedback

## 📚 Documentation

- **[GET_STARTED.md](GET_STARTED.md)** - Quick start guide (15 minutes)
- **[ML_SETUP_GUIDE.md](ML_SETUP_GUIDE.md)** - Detailed ML system setup
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Production deployment guide
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Technical architecture deep dive
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Commands and API reference
- **[INTEGRATION_EXAMPLE.md](INTEGRATION_EXAMPLE.md)** - Code integration examples
- **[FAQ.md](FAQ.md)** - Frequently asked questions
- **[IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)** - Progress tracking

## 📧 Contact

Your Name - [@prakharshri2005](https://x.com/prakharshri2005)

Project Link: [https://sketchcalibur.vercel.app/](https://sketchcalibur.vercel.app/)

---

**Built with ❤️ for creative collaboration**
