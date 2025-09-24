// Fix: Import React and ReactDOM to resolve 'React' and 'ReactDOM' not found errors.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

const App = () => {
  const [originalImage, setOriginalImage] = React.useState(null);
  const [generatedImage, setGeneratedImage] = React.useState(null);
  const [loadingState, setLoadingState] = React.useState('idle'); // 'idle', 'generating', 'coloring'
  const [error, setError] = React.useState(null);
  const [selectedStyle, setSelectedStyle] = React.useState('Oil Painting');
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);

  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const fileToGenerativePart = async (file) => {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      // Fix: Cast reader.result to string to avoid type error with split.
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };
  
  const base64ToGenerativePart = (base64Data, mimeType) => {
    return {
      inlineData: {
        data: base64Data.split(',')[1],
        mimeType: mimeType
      }
    };
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setGeneratedImage(null);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage({
          src: reader.result as string,
          type: file.type,
          file: file,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const generateOutline = async () => {
    if (!originalImage) return;
    setLoadingState('generating');
    setError(null);
    setGeneratedImage(null);

    try {
      const imagePart = base64ToGenerativePart(originalImage.src, originalImage.type);
      const prompt = "Extract the line art from this image to create a coloring book page. The background must be pure white and the lines should be bold and black. Do not add any color or shading.";

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      const generatedImagePart = parts?.find(part => part.inlineData);

      if (generatedImagePart && generatedImagePart.inlineData) {
        const mimeType = generatedImagePart.inlineData.mimeType;
        const base64Data = generatedImagePart.inlineData.data;
        setGeneratedImage(`data:${mimeType};base64,${base64Data}`);
      } else {
         console.error("Model response did not contain an image part:", response);
         throw new Error("Could not generate outline. The model did not return an image.");
      }
    } catch (err) {
      console.error(err);
      setError('Failed to generate outline. Please try again.');
    } finally {
      setLoadingState('idle');
    }
  };

  const applyColoringStyle = async () => {
    if (!originalImage) return;
    setLoadingState('coloring');
    setError(null);
    setGeneratedImage(null);

    try {
      const imagePart = base64ToGenerativePart(originalImage.src, originalImage.type);
      const prompt = `Recreate this image in the style of a vibrant ${selectedStyle}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });
      
      const parts = response.candidates?.[0]?.content?.parts;
      const generatedImagePart = parts?.find(part => part.inlineData);

      if (generatedImagePart && generatedImagePart.inlineData) {
        const mimeType = generatedImagePart.inlineData.mimeType;
        const base64Data = generatedImagePart.inlineData.data;
        setGeneratedImage(`data:${mimeType};base64,${base64Data}`);
      } else {
         console.error("Model response did not contain an image part:", response);
         throw new Error("Could not apply style. The model did not return an image.");
      }
    } catch (err) {
      console.error(err);
      setError('Failed to apply coloring style. Please try again.');
    } finally {
      setLoadingState('idle');
    }
  };

  const openCamera = async () => {
    setIsCameraOpen(true);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    } catch (err) {
        console.error("Error accessing camera: ", err);
        setError("Could not access camera. Please check permissions.");
        setIsCameraOpen(false);
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
        const imageDataUrl = canvasRef.current.toDataURL('image/png');
        setOriginalImage({
          src: imageDataUrl,
          type: 'image/png',
          file: null, // No file object for camera captures
        });
        setGeneratedImage(null);
        setError(null);
        closeCamera();
    }
  };

  const styles = ['Oil Painting', 'Acrylic Painting', 'Watercolor', 'Pop Art', 'Rembrandt', 'Mondrian'];

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 md:p-8">
      {isCameraOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
              <video ref={videoRef} autoPlay playsInline className="w-full max-w-2xl rounded-lg shadow-xl"></video>
              <div className="flex space-x-4 mt-4">
                  <button onClick={captureImage} className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-md text-white font-semibold transition-colors">Capture</button>
                  <button onClick={closeCamera} className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-white font-semibold transition-colors">Close</button>
              </div>
              <canvas ref={canvasRef} className="hidden"></canvas>
          </div>
      )}

      <header className="w-full max-w-6xl text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-500">OutlineColor AI</h1>
        <p className="text-gray-400 mt-2">Transform your photos into art.</p>
      </header>
      
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls Column */}
        <div className="flex flex-col space-y-6 bg-gray-800 p-6 rounded-2xl shadow-lg">
          <div>
            <h2 className="text-2xl font-semibold mb-3">1. Add Your Image</h2>
            <div className="flex space-x-4">
              <label htmlFor="file-upload" className="flex-1 cursor-pointer text-center px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors font-semibold">
                Upload Image
              </label>
              <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <button onClick={openCamera} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-semibold">Use Camera</button>
            </div>
          </div>
          
          {originalImage && (
            <>
              <div>
                <h3 className="text-lg font-medium mb-2">Original</h3>
                <img src={originalImage.src} alt="Original" className="rounded-lg w-full object-contain max-h-64 shadow-md" />
              </div>
              
              <div>
                <h2 className="text-2xl font-semibold mb-3">2. Create Your Art</h2>
                <button 
                  onClick={generateOutline} 
                  disabled={loadingState !== 'idle'}
                  className="w-full px-4 py-3 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors font-bold disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center">
                  {loadingState === 'generating' && <div className="loader-small mr-2"></div>}
                  Generate Coloring Outline
                </button>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Or, Apply an Artistic Style</h3>
                 <div className="grid grid-cols-3 gap-2 mb-4">
                    {styles.map(style => (
                        <button key={style} onClick={() => setSelectedStyle(style)} className={`px-2 py-2 text-sm rounded-md transition-colors ${selectedStyle === style ? 'bg-violet-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                            {style}
                        </button>
                    ))}
                </div>
                <button 
                  onClick={applyColoringStyle} 
                  disabled={loadingState !== 'idle'}
                  className="w-full px-4 py-3 bg-pink-500 text-white rounded-md hover:bg-pink-600 transition-colors font-bold disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center">
                  {loadingState === 'coloring' && <div className="loader-small mr-2"></div>}
                  Apply Style: {selectedStyle}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Result Column */}
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[400px]">
          <h2 className="text-2xl font-semibold mb-4 self-start">Result</h2>
          <div className="w-full flex-grow flex items-center justify-center bg-gray-900/50 rounded-lg">
             {loadingState !== 'idle' && <div className="loader"></div>}
             {error && <p className="text-red-400 text-center">{error}</p>}
             {loadingState === 'idle' && generatedImage && (
                <div className="flex flex-col items-center space-y-4">
                    <img src={generatedImage} alt="Generated" className="rounded-lg max-w-full max-h-[50vh] object-contain shadow-md" />
                    <a href={generatedImage} download="outline-color-art.png" className="px-6 py-2 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600 transition-colors">Download</a>
                </div>
             )}
             {loadingState === 'idle' && !generatedImage && !error && (
                <p className="text-gray-400 text-center">Your generated art will appear here.</p>
             )}
          </div>
        </div>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);