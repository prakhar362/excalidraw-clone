"""
Test script for handwriting to beautiful text system
Run this to verify all components are working
"""

import requests
from PIL import Image, ImageDraw, ImageFont
import io
import json

# Configuration
API_BASE = "http://localhost:8000"

def create_test_image(text: str, size=(400, 100)) -> bytes:
    """Create a simple test image with text"""
    img = Image.new('RGB', size, color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw text (simulating handwriting)
    try:
        # Try to use a handwriting-like font
        font = ImageFont.truetype("arial.ttf", 40)
    except:
        font = ImageFont.load_default()
    
    draw.text((20, 30), text, fill='black', font=font)
    
    # Convert to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    return img_bytes.getvalue()

def test_health():
    """Test 1: Health check"""
    print("\n" + "="*60)
    print("TEST 1: Health Check")
    print("="*60)
    
    try:
        response = requests.get(f"{API_BASE}/health")
        data = response.json()
        
        print(f"✅ Status: {data['status']}")
        print(f"✅ Models loaded: {data['models_loaded']}")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_model_info():
    """Test 2: Model information"""
    print("\n" + "="*60)
    print("TEST 2: Model Information")
    print("="*60)
    
    try:
        response = requests.get(f"{API_BASE}/api/ml/model-info")
        data = response.json()
        
        print(json.dumps(data, indent=2))
        return True
    except Exception as e:
        print(f"❌ Model info failed: {e}")
        return False

def test_text_detection():
    """Test 3: Text region detection"""
    print("\n" + "="*60)
    print("TEST 3: Text Region Detection")
    print("="*60)
    
    try:
        # Create test image
        img_bytes = create_test_image("Hello World")
        
        # Send to API
        files = {'file': ('test.png', img_bytes, 'image/png')}
        response = requests.post(f"{API_BASE}/api/ml/detect-text-regions", files=files)
        data = response.json()
        
        print(f"✅ Success: {data['success']}")
        print(f"✅ Regions detected: {data['regions_count']}")
        
        if data['regions']:
            for i, region in enumerate(data['regions']):
                print(f"\nRegion {i+1}:")
                print(f"  Text: {region['text']}")
                print(f"  Confidence: {region['confidence']:.2f}")
                print(f"  BBox: {region['bbox']}")
        
        return True
    except Exception as e:
        print(f"❌ Text detection failed: {e}")
        return False

def test_single_text_processing():
    """Test 4: Single text processing (legacy endpoint)"""
    print("\n" + "="*60)
    print("TEST 4: Single Text Processing")
    print("="*60)
    
    try:
        # Create test image
        img_bytes = create_test_image("PROJECT TIMELINE")
        
        # Send to API
        files = {'file': ('test.png', img_bytes, 'image/png')}
        data_form = {'force_intent': 'handwriting'}
        response = requests.post(f"{API_BASE}/api/ml/process", files=files, data=data_form)
        data = response.json()
        
        print(f"✅ Success: {data['success']}")
        print(f"✅ Text: {data.get('text', 'N/A')}")
        
        if 'styling' in data:
            print(f"\nAI Styling:")
            print(f"  Type: {data['styling']['textType']}")
            print(f"  Font Size: {data['styling']['fontSize']}px")
            print(f"  Color: {data['styling']['strokeColor']}")
            print(f"  Confidence: {data['styling']['confidence']:.2f}")
        
        if 'elements' in data:
            print(f"\n✅ Elements created: {len(data['elements'])}")
        
        return True
    except Exception as e:
        print(f"❌ Single text processing failed: {e}")
        return False

def test_multi_text_processing():
    """Test 5: Multi-text processing (new endpoint)"""
    print("\n" + "="*60)
    print("TEST 5: Multi-Text Processing")
    print("="*60)
    
    try:
        # Create test image with multiple text regions
        img = Image.new('RGB', (600, 300), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("arial.ttf", 30)
        except:
            font = ImageFont.load_default()
        
        # Draw multiple text regions
        draw.text((50, 30), "PROJECT TIMELINE", fill='black', font=font)
        draw.text((50, 120), "Phase 1: Planning", fill='black', font=font)
        draw.text((50, 210), "Phase 2: Development", fill='black', font=font)
        
        # Convert to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        # Send to API
        files = {'file': ('test.png', img_bytes.getvalue(), 'image/png')}
        response = requests.post(f"{API_BASE}/api/ml/process-multi-text", files=files)
        data = response.json()
        
        print(f"✅ Success: {data['success']}")
        print(f"✅ Regions processed: {data['regions_count']}")
        print(f"✅ Elements created: {len(data['elements'])}")
        
        for i, element in enumerate(data['elements']):
            print(f"\nElement {i+1}:")
            print(f"  Text: {element['text']}")
            print(f"  Type: {element.get('textType', 'N/A')}")
            print(f"  Font Size: {element['fontSize']}px")
            print(f"  Color: {element['strokeColor']}")
            print(f"  Position: ({element['x']}, {element['y']})")
        
        return True
    except Exception as e:
        print(f"❌ Multi-text processing failed: {e}")
        return False

def test_text_types():
    """Test 6: Different text types"""
    print("\n" + "="*60)
    print("TEST 6: Text Type Detection")
    print("="*60)
    
    test_cases = [
        ("PROJECT TIMELINE", "title"),
        ("TODO: Fix bug", "warning"),
        ("✓ Done", "success"),
        ("function hello()", "code"),
        ("Note: Remember this", "subtitle"),
    ]
    
    results = []
    
    for text, expected_type in test_cases:
        try:
            img_bytes = create_test_image(text)
            files = {'file': ('test.png', img_bytes, 'image/png')}
            data_form = {'force_intent': 'handwriting'}
            response = requests.post(f"{API_BASE}/api/ml/process", files=files, data=data_form)
            data = response.json()
            
            detected_type = data.get('styling', {}).get('textType', 'unknown')
            color = data.get('styling', {}).get('strokeColor', 'N/A')
            
            match = "✅" if detected_type == expected_type else "⚠️"
            print(f"{match} '{text}' → {detected_type} (expected: {expected_type}) | Color: {color}")
            
            results.append(detected_type == expected_type)
        except Exception as e:
            print(f"❌ Failed to test '{text}': {e}")
            results.append(False)
    
    accuracy = sum(results) / len(results) * 100
    print(f"\n✅ Type detection accuracy: {accuracy:.0f}%")
    
    return accuracy > 50

def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("HANDWRITING TO BEAUTIFUL TEXT - TEST SUITE")
    print("="*60)
    
    tests = [
        ("Health Check", test_health),
        ("Model Info", test_model_info),
        ("Text Detection", test_text_detection),
        ("Single Text Processing", test_single_text_processing),
        ("Multi-Text Processing", test_multi_text_processing),
        ("Text Type Detection", test_text_types),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n{passed}/{total} tests passed ({passed/total*100:.0f}%)")
    
    if passed == total:
        print("\n🎉 All tests passed! System is ready!")
    elif passed >= total * 0.7:
        print("\n⚠️ Most tests passed. Some features may need attention.")
    else:
        print("\n❌ Many tests failed. Please check the logs.")

if __name__ == "__main__":
    print("Starting test suite...")
    print("Make sure the ML backend is running on http://localhost:8000")
    print()
    
    try:
        run_all_tests()
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Test suite crashed: {e}")
