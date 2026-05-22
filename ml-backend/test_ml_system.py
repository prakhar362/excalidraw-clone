#!/usr/bin/env python3
"""
Test script for SketchCalibur ML System
Run this to verify all components are working
"""

import requests
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import io

ML_API_URL = "http://127.0.0.1:8000"

def create_test_sketch():
    """Create a simple test sketch image"""
    img = Image.new('RGB', (400, 400), 'white')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple face
    draw.ellipse([100, 100, 300, 300], outline='black', width=3)  # Face
    draw.ellipse([150, 150, 180, 180], fill='black')  # Left eye
    draw.ellipse([220, 150, 250, 180], fill='black')  # Right eye
    draw.arc([150, 200, 250, 280], 0, 180, fill='black', width=3)  # Smile
    
    return img

def create_test_math():
    """Create a test math equation image"""
    img = Image.new('RGB', (400, 200), 'white')
    draw = ImageDraw.Draw(img)
    
    try:
        font = ImageFont.truetype("arial.ttf", 40)
    except:
        font = ImageFont.load_default()
    
    draw.text((50, 80), "2x + 5 = 15", fill='black', font=font)
    
    return img

def create_test_handwriting():
    """Create a test handwriting image"""
    img = Image.new('RGB', (400, 200), 'white')
    draw = ImageDraw.Draw(img)
    
    try:
        font = ImageFont.truetype("arial.ttf", 30)
    except:
        font = ImageFont.load_default()
    
    draw.text((50, 80), "Hello World", fill='black', font=font)
    
    return img

def image_to_bytes(img):
    """Convert PIL Image to bytes"""
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

def test_health():
    """Test health endpoint"""
    print("\n[TEST] Testing Health Endpoint...")
    try:
        response = requests.get(f"{ML_API_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"[OK] Health check passed: {data}")
            return True
        else:
            print(f"[FAIL] Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"[FAIL] Health check error: {e}")
        return False

def test_classify(img, name):
    """Test classification endpoint"""
    print(f"\n[TEST] Testing Classification for {name}...")
    try:
        files = {'file': ('test.png', image_to_bytes(img), 'image/png')}
        response = requests.post(f"{ML_API_URL}/api/ml/detect", files=files, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print(f"[OK] Classification successful:")
            print(f"   Intent: {data['intent']}")
            print(f"   Confidence: {data['confidence']:.2%}")
            print(f"   All scores: {data['all_scores']}")
            return True
        else:
            print(f"[FAIL] Classification failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"[FAIL] Classification error: {e}")
        return False

def test_process(img, name, force_intent=None):
    """Test processing endpoint"""
    print(f"\n[TEST] Testing Processing for {name}...")
    try:
        files = {'file': ('test.png', image_to_bytes(img), 'image/png')}
        data = {}
        if force_intent:
            data['force_intent'] = force_intent
        
        response = requests.post(
            f"{ML_API_URL}/api/ml/process", 
            files=files, 
            data=data,
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"[OK] Processing successful:")
            print(f"   Intent: {result['intent']}")
            print(f"   Result Type: {result['result_type']}")
            print(f"   Message: {result['message']}")
            print(f"   Elements: {len(result['elements'])} generated")
            
            if 'text' in result:
                print(f"   Recognized Text: {result['text']}")
            if 'solution' in result:
                print(f"   Solution: {result['solution']}")
            if 'steps' in result:
                print(f"   Steps: {len(result['steps'])} steps")
            
            return True
        else:
            print(f"[FAIL] Processing failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"[FAIL] Processing error: {e}")
        return False

def test_enhance_sketch_v2():
    """Test the new advanced sketch enhancement endpoint"""
    print("\n[TEST] Testing Advanced Sketch Enhancement V2 Endpoint...")
    try:
        sketch_img = create_test_sketch()
        files = {'file': ('test.png', image_to_bytes(sketch_img), 'image/png')}
        data = {
            'style': 'professional',
            'use_ai': 'false',
            'return_vectors': 'true',
            'return_preview': 'true'
        }
        response = requests.post(f"{ML_API_URL}/api/ml/enhance-sketch", files=files, data=data, timeout=30)
        if response.status_code == 200:
            res = response.json()
            print("[OK] Advanced sketch enhancement successful:")
            print(f"   Success: {res.get('success')}")
            print(f"   Style: {res.get('style')}")
            print(f"   Method: {res.get('method')}")
            print(f"   Confidence: {res.get('confidence')}")
            print(f"   Vectors count: {res.get('element_count')}")
            print(f"   Preview key present: {'preview' in res}")
            return True
        else:
            print(f"[FAIL] Advanced sketch enhancement failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"[FAIL] Advanced sketch enhancement error: {e}")
        return False

def main():
    print("=" * 60)
    print("SketchCalibur ML System Test Suite")
    print("=" * 60)
    
    results = []
    
    # Test 1: Health Check
    results.append(("Health Check", test_health()))
    
    if not results[0][1]:
        print("\n[FAIL] ML API is not running. Please start it first:")
        print("   cd ml-backend")
        print("   uvicorn main:app --reload --port 8000")
        sys.exit(1)
    
    # Wait for models to load
    print("\n[WAIT] Waiting for models to load (this may take 30-60 seconds on first run)...")
    
    # Test 2: Sketch Classification
    sketch_img = create_test_sketch()
    results.append(("Sketch Classification", test_classify(sketch_img, "Sketch")))
    
    # Test 3: Sketch Processing
    results.append(("Sketch Processing", test_process(sketch_img, "Sketch", "artistic_sketch")))
    
    # Test 3b: Advanced Sketch Enhancement V2
    results.append(("Advanced Sketch Enhancement V2", test_enhance_sketch_v2()))
    
    # Test 4: Math Classification
    math_img = create_test_math()
    results.append(("Math Classification", test_classify(math_img, "Math")))
    
    # Test 5: Math Processing
    results.append(("Math Processing", test_process(math_img, "Math", "mathematical")))
    
    # Test 6: Handwriting Classification
    text_img = create_test_handwriting()
    results.append(("Handwriting Classification", test_classify(text_img, "Handwriting")))
    
    # Test 7: Handwriting Processing
    results.append(("Handwriting Processing", test_process(text_img, "Handwriting", "handwriting")))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"[{status}] - {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n[SUCCESS] All tests passed! ML system is working correctly.")
        return 0
    else:
        print(f"\n[WARN] {total - passed} test(s) failed. Please check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
