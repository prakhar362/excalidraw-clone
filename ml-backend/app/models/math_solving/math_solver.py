"""
Math Solver - 3-tier OCR pipeline:

  Tier 0 → Roboflow HTTP API  (serverless workflow, fastest)
  Tier 1 → Gemini Vision      (multimodal LLM, best for messy handwriting)
  Tier 2 → EasyOCR            (multi-pass local OCR, no internet needed)
  Tier 3 → Contour            (OpenCV symbol segmentation, last resort)

Then SymPy solves the resulting equation string.
"""

import re
import os
import base64
from io import BytesIO
import cv2
import numpy as np
from PIL import Image
from typing import List, Dict, Optional, Tuple
from sympy import sympify, latex, solve, simplify, symbols
from dotenv import load_dotenv

load_dotenv()


class MathSolver:

    _reader: Optional[object] = None   # EasyOCR singleton

    def __init__(self):
        print("Initializing Math Solver (Roboflow + Gemini + EasyOCR + SymPy)...")

    def solve(self, image: Image.Image) -> Dict:
        print("\n" + "="*55)
        print("MATH SOLVER: starting recognition")
        print("="*55)

        # ── Tier 0: Roboflow ──────────────────────────────────────────
        roboflow_eq = self._roboflow_read(image)
        if roboflow_eq:
            print(f"Roboflow read: '{roboflow_eq}'")
            for interp in self._generate_interpretations(roboflow_eq):
                result = self._try_solve(interp)
                if result:
                    return result

        # ── Tier 1: Gemini Vision ─────────────────────────────────────
        gemini_eq = self._gemini_read(image)
        if gemini_eq:
            print(f"Gemini Vision read: '{gemini_eq}'")
            for interp in self._generate_interpretations(gemini_eq):
                result = self._try_solve(interp)
                if result:
                    return result

        # ── Tier 2: EasyOCR ───────────────────────────────────────────
        candidates = self._easyocr_all_candidates(image)
        print(f"EasyOCR candidates: {[c for c,_ in candidates]}")
        for raw, score in candidates:
            for interp in self._generate_interpretations(raw):
                print(f"  Trying: '{interp}'")
                result = self._try_solve(interp)
                if result:
                    return result

        # ── Tier 3: Contour fallback ──────────────────────────────────
        preprocessed = self._preprocess(image)
        fallback = self._contour_fallback(preprocessed)
        print(f"Contour fallback  : '{fallback}'")
        if fallback:
            result = self._try_solve(fallback)
            if result:
                return result

        return {"success": False, "error": "Could not read or solve the equation"}

    def _try_solve(self, equation_str: str) -> Optional[Dict]:
        """Attempt SymPy solve; return None on any failure."""
        if not equation_str or len(equation_str) < 2:
            return None
        try:
            result = self._solve_equation(equation_str)
            sol_str = ", ".join(result["solution"])
            print(f"\n{'='*55}")
            print(f" SOLVED  :  {equation_str}")
            print(f"   Solution :  {sol_str}")
            print(f"{'='*55}\n")
            return {
                "success":           True,
                "original_equation": equation_str,
                "latex":             result["latex"],
                "solution":          result["solution"],
                "steps":             result["steps"],
            }
        except Exception as e:
            print(f"    SymPy failed for '{equation_str}': {e}")
            return None

    # ------------------------------------------------------------------ #
    #  Tier 0: Roboflow Inference                                          #
    # ------------------------------------------------------------------ #

    def _roboflow_read(self, image: Image.Image) -> str:
        """
        Use Roboflow HTTP API to detect and read math equations.
        Returns a plain equation string like 'x+3=5', or '' on failure.
        """
        api_key = os.environ.get("ROBOFLOW_API_KEY", "")
        if not api_key:
            print("Roboflow: ROBOFLOW_API_KEY not set, skipping")
            return ""

        try:
            import requests
            
            # Convert image to base64
            buffered = BytesIO()
            image.save(buffered, format="JPEG")
            img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            # Prepare the request
            url = "https://serverless.roboflow.com/prakhar-yc6s2/workflows/detect-count-and-visualize"
            headers = {
                "Content-Type": "application/json"
            }
            payload = {
                "api_key": api_key,
                "inputs": {
                    "image": {
                        "type": "base64",
                        "value": img_b64
                    }
                }
            }
            
            # Make the request
            print("Roboflow: Sending request to workflow...")
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code != 200:
                print(f"Roboflow error: HTTP {response.status_code} - {response.text}")
                return ""
            
            result = response.json()
            print(f"Roboflow response: {result}")
            
            # Extract equation from result
            # The workflow should return detected text/equation
            equation = ""
            
            if isinstance(result, dict):
                # Try to extract from various possible response formats
                # Common keys: 'output', 'predictions', 'detections', 'text', 'ocr_text'
                for key in ['text', 'equation', 'detected_text', 'ocr_text', 'output', 'result']:
                    if key in result:
                        equation = str(result[key])
                        break
                
                # If there's a predictions array
                if not equation and 'predictions' in result:
                    predictions = result['predictions']
                    if isinstance(predictions, list) and len(predictions) > 0:
                        pred = predictions[0]
                        if isinstance(pred, dict):
                            # Try common prediction keys
                            for key in ['class', 'text', 'label', 'value']:
                                if key in pred:
                                    equation = str(pred[key])
                                    break
                
                # If there's an outputs object
                if not equation and 'outputs' in result:
                    outputs = result['outputs']
                    if isinstance(outputs, dict):
                        for key in outputs.keys():
                            if isinstance(outputs[key], str):
                                equation = outputs[key]
                                break
            
            elif isinstance(result, list) and len(result) > 0:
                # Result is a list, take first item
                first = result[0]
                if isinstance(first, dict):
                    for key in ['text', 'equation', 'class', 'label']:
                        if key in first:
                            equation = str(first[key])
                            break
                elif isinstance(first, str):
                    equation = first
            
            if equation:
                print(f"Roboflow extracted: '{equation}'")
                equation = self._clean_math_text(equation)
                return equation
            
            print("Roboflow: No equation detected in response")
            return ""
            
        except requests.exceptions.Timeout:
            print("Roboflow error: Request timeout")
            return ""
        except requests.exceptions.RequestException as e:
            print(f"Roboflow request error: {e}")
            return ""
        except Exception as e:
            print(f"Roboflow error: {e}")
            return ""

    # ------------------------------------------------------------------ #
    #  Tier 1: Gemini Vision                                               #
    # ------------------------------------------------------------------ #

    def _gemini_read(self, image: Image.Image) -> str:
        """
        Send the canvas image to Gemini 1.5 Flash with a tightly scoped
        prompt.  The model understands handwriting far better than any
        local OCR because it was trained on billions of image-text pairs.

        Returns a plain equation string like 'x+3=5', or '' on failure.
        """
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            print("Gemini: GEMINI_API_KEY not set, skipping")
            return ""

        try:
            import google.generativeai as genai  # lazy import
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.5-flash")

            # Encode image as base64 PNG for the API
            buf = BytesIO()
            image.save(buf, format="PNG")
            img_b64 = base64.b64encode(buf.getvalue()).decode()

            prompt = (
                "This image shows a handwritten mathematical equation drawn on a canvas.\n"
                "Your task: extract ONLY the equation as plain text.\n"
                "Rules:\n"
                "  - Use standard ASCII math: + - * / = ( )\n"
                "  - Use lowercase letters for variables: x y z n\n"
                "  - Do NOT include any explanation, just the equation\n"
                "  - Example output: x+3=5\n"
                "Output the equation now:"
            )

            response = model.generate_content([
                prompt,
                {"mime_type": "image/png", "data": img_b64},
            ])

            raw = response.text.strip()
            print(f"Gemini raw output: '{raw}'")

            # Strip any surrounding explanation the model might have added
            # e.g. 'The equation is: x+3=5' → 'x+3=5'
            match = re.search(r'[0-9a-zA-Z][^\n]*[=][^\n]*', raw)
            eq = match.group(0).strip() if match else raw

            # Run through cleaner
            eq = self._clean_math_text(eq)
            return eq

        except Exception as e:
            print(f"Gemini Vision error: {e}")
            return ""

    # ------------------------------------------------------------------ #
    #  Tier 2: EasyOCR                                                     #
    # ------------------------------------------------------------------ #

    def _get_reader(self) -> object:
        if MathSolver._reader is None:
            # Prevent OOM crashes on memory-constrained servers (like Render's 512 MB tier)
            from app.config import config
            if not getattr(config, "ENABLE_LOCAL_EASYOCR", False):
                print("EasyOCR is disabled via config to prevent memory limit exhaustion (OOM).")
                return None

            try:
                import easyocr
                print("Loading EasyOCR model (first time)...")
                MathSolver._reader = easyocr.Reader(["en"], gpu=False, verbose=False)
                print("EasyOCR loaded.")
            except Exception as e:
                print(f"Failed to load easyocr (likely OOM): {e}")
                return None
        return MathSolver._reader

    def _easyocr_all_candidates(self, image: Image.Image) -> List[Tuple[str, int]]:
        """
        Run EasyOCR on 3 image variants × 2 sensitivity configs.
        Return deduplicated (raw_text, score) list, best-first.
        NO allowlist — it constrains CRNN beam search and lowers accuracy.
        """
        reader   = self._get_reader()
        if reader is None:
            return []
        
        variants = self._preprocess_variants(image)
        seen: Dict[str, int] = {}

        for img_np in variants:
            for cfg in [
                {"detail": 1, "paragraph": False, "low_text": 0.3, "text_threshold": 0.6},
                {"detail": 1, "paragraph": False, "low_text": 0.2, "text_threshold": 0.4},
            ]:
                try:
                    results = reader.readtext(img_np, **cfg)
                    if not results:
                        continue
                    results.sort(key=lambda r: r[0][0][0])   # left → right
                    candidate = " ".join(t for (_, t, _) in results).strip()
                    score     = self._math_score(candidate)
                    print(f"  OCR candidate: '{candidate}'  score={score}")
                    if candidate not in seen or score > seen[candidate]:
                        seen[candidate] = score
                except Exception as e:
                    print(f"  OCR pass error: {e}")

        return sorted(seen.items(), key=lambda x: x[1], reverse=True)

    @staticmethod
    def _math_score(text: str) -> int:
        """
        Score a raw OCR candidate.

        Penalises malformed patterns:
          • operator immediately before '='  (e.g. '+=')  → -20
          • '=' at start or end               → -10

        Rewards balanced, content-rich equations:
          • '=' with non-empty both sides     → +15
          • each digit                        → +3
          • each arithmetic operator          → +2
          • each variable (t/T count as x)    → +2
        """
        t = re.sub(r'\s+', '', text.lower())

        has_eq      = int('=' in t)
        digit_count = sum(c.isdigit() for c in t)
        op_count    = sum(c in '+-*/' for c in t)
        var_count   = sum(c in 'txyzn' for c in t)   # t/T = likely handwritten x
        length      = len(t)

        penalty, bonus = 0, 0
        if re.search(r'[+\-*/]=', t):
            penalty += 20
        if t.startswith('=') or t.endswith('='):
            penalty += 10
        if '=' in t:
            parts = t.split('=', 1)
            bonus += 15 if (parts[0] and parts[1]) else -5

        return has_eq * 10 + digit_count * 3 + op_count * 2 + var_count * 2 + length + bonus - penalty

    # ------------------------------------------------------------------ #
    #  Multi-interpretation generator                                      #
    # ------------------------------------------------------------------ #

    def _generate_interpretations(self, raw: str) -> List[str]:
        """
        From one raw OCR string generate every plausible cleaned form.
        Handles the most common EasyOCR errors for handwritten math:
          • x → T or 7   (cross-shaped strokes)
          • = → - or ' =' (two bars read as one, or split)

        Output is sorted so interpretations with a variable AND '=' come
        first — this prevents pure-arithmetic evaluations (e.g. 7+3-5=5)
        from being accepted instead of the intended equation (x+3=5).
        """
        base = self._clean_math_text(raw)
        if not base:
            return []

        seen: set = set()
        interps: List[str] = []

        def add(s: str):
            s = re.sub(r'[+\-*/=]+$', '', s).strip()
            if s and s not in seen:
                seen.add(s)
                interps.append(s)

        # Base cleaned version
        add(base)

        # T/t → x  (handwritten x misread as T)
        t_as_x = re.sub(r'\bT\b', 'x', base, flags=re.IGNORECASE)
        add(t_as_x)

        # Leading 7 → x  (diagonal stroke confused with x)
        add(re.sub(r'^7(?=[+\-*/=])', 'x', base))
        add(re.sub(r'^7(?=[+\-*/=])', 'x', t_as_x))

        # If no '=' found, try replacing the LAST '-' with '='
        for candidate in list(interps):
            if '=' not in candidate and '-' in candidate:
                idx = candidate.rfind('-')
                add(candidate[:idx] + '=' + candidate[idx + 1:])

        # ── Sort: var+eq > eq-only > var-only > arithmetic ─────────────
        # This ensures x+3=5 is tried before 7+3-5 (pure arithmetic)
        def _priority(s: str) -> int:
            has_var = bool(re.search(r'[a-zA-Z]', s))
            has_eq  = '=' in s
            if has_var and has_eq:   return 0   # best: equation with unknown
            if has_eq:               return 1   # equation, no variable
            if has_var:              return 2   # expression with variable
            return 3                            # pure arithmetic (last resort)

        interps.sort(key=_priority)
        return interps

    # ------------------------------------------------------------------ #
    #  Tier 3: Contour-based symbol fallback                               #
    # ------------------------------------------------------------------ #

    def _contour_fallback(self, image: Image.Image) -> str:
        gray = np.array(image.convert("L"))
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return ""

        bboxes = [cv2.boundingRect(c) for c in contours]
        bboxes = [b for b in bboxes if b[2] > 4 and b[3] > 4]
        bboxes.sort(key=lambda b: b[0])

        symbols_found = []
        img_h = gray.shape[0]

        for (x, y, w, h) in bboxes:
            roi = binary[y:y+h, x:x+w]
            sym = self._classify_symbol(roi, w, h, img_h)
            if sym:
                symbols_found.append((x, sym))

        equation = "".join(sym for _, sym in symbols_found)
        return self._clean_math_text(equation)

    def _classify_symbol(self, roi: np.ndarray, w: int, h: int, img_h: int) -> str:
        aspect  = w / max(h, 1)
        density = np.sum(roi > 0) / max(w * h, 1)

        if aspect > 1.5 and density < 0.45:
            rows     = [np.sum(roi[r, :]) for r in range(h)]
            mid      = h // 2
            top_half = sum(rows[:mid])
            bot_half = sum(rows[mid:])
            if top_half > 500 and bot_half > 500:
                return "="

        if aspect > 2.5 and density < 0.35:
            return "-"

        if 0.7 < aspect < 1.4:
            cx, cy = w // 2, h // 2
            h_line = int(np.sum(roi[cy-2:cy+2, :]) > w * 80)
            v_line = int(np.sum(roi[:, cx-2:cx+2]) > h * 80)
            if h_line and v_line:
                return "+"

        _, labels = cv2.connectedComponents(255 - roi)
        holes = labels.max() - 1

        if holes == 0:
            return "1"
        if holes == 1:
            return "0"
        if holes == 2:
            return "8"
        return "x"

    # ------------------------------------------------------------------ #
    #  SymPy solver                                                        #
    # ------------------------------------------------------------------ #

    def _solve_equation(self, equation: str) -> Dict:
        x, y, z, n = symbols("x y z n")
        local_syms  = {"x": x, "y": y, "z": z, "n": n}

        if "=" in equation:
            left_str, right_str = equation.split("=", 1)
            if not left_str.strip() or not right_str.strip():
                raise ValueError(f"Empty side in equation: '{equation}'")
            left      = sympify(left_str.strip(),  locals=local_syms)
            right     = sympify(right_str.strip(), locals=local_syms)
            expr      = left - right
            latex_str = f"{latex(left)} = {latex(right)}"
        else:
            expr      = sympify(equation, locals=local_syms)
            left      = expr
            right     = sympify("0")
            latex_str = latex(expr)

        free_vars = list(expr.free_symbols)

        if free_vars:
            var       = free_vars[0]
            solutions = solve(expr, var)
        else:
            solutions = [simplify(expr)]

        if not solutions:
            raise ValueError("No solution found")

        steps = self._build_steps(equation, expr, solutions, free_vars)

        return {
            "latex":    latex_str,
            "solution": [str(s) for s in solutions],
            "steps":    steps,
        }

    def _build_steps(self, original, expr, solutions, free_vars) -> List[str]:
        steps      = [f"Equation: {original}"]
        simplified = simplify(expr)
        if simplified != expr:
            steps.append(f"Simplified: {simplified} = 0")
        if free_vars:
            var = free_vars[0]
            steps.append(f"Solving for {var}:")
            for sol in solutions:
                steps.append(f"  {var} = {sol}")
        else:
            steps.append(f"Result: {solutions[0] if solutions else 'undefined'}")
        return steps

    # ------------------------------------------------------------------ #
    #  Preprocessing — 3 variants for EasyOCR multi-pass                  #
    # ------------------------------------------------------------------ #

    def _preprocess_variants(self, image: Image.Image) -> list:
        img  = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

        h, w   = gray.shape
        target = 800
        if max(h, w) < target:
            scale = target / max(h, w)
            gray  = cv2.resize(gray, (int(w * scale), int(h * scale)),
                               interpolation=cv2.INTER_CUBIC)

        variants = []

        clahe   = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        v1      = clahe.apply(gray)
        v1      = cv2.fastNlMeansDenoising(v1, h=8)
        variants.append(cv2.cvtColor(v1, cv2.COLOR_GRAY2RGB))

        _, v2 = cv2.threshold(v1, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants.append(cv2.cvtColor(v2, cv2.COLOR_GRAY2RGB))

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        v3     = cv2.bitwise_not(cv2.dilate(cv2.bitwise_not(v2), kernel, iterations=1))
        variants.append(cv2.cvtColor(v3, cv2.COLOR_GRAY2RGB))

        return variants

    def _preprocess(self, image: Image.Image) -> Image.Image:
        img  = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        h, w = gray.shape
        if max(h, w) < 600:
            scale = 600 / max(h, w)
            gray  = cv2.resize(gray, (int(w * scale), int(h * scale)),
                               interpolation=cv2.INTER_CUBIC)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray  = clahe.apply(gray)
        gray  = cv2.fastNlMeansDenoising(gray, h=8)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return Image.fromarray(cv2.cvtColor(binary, cv2.COLOR_GRAY2RGB))

    # ------------------------------------------------------------------ #
    #  Text cleaning (EasyOCR output → SymPy-parseable string)            #
    # ------------------------------------------------------------------ #

    def _clean_math_text(self, text: str) -> str:
        if not text:
            return ""
        t = text.strip()

        ocr_fixes = [
            # MOST IMPORTANT: handwritten x → looks like T to OCR
            ("T", "x"),
            # Variable case normalisation
            ("X", "x"), ("Y", "y"), ("Z", "z"), ("N", "n"),
            # Digit lookalikes
            ("O", "0"), ("o", "0"), ("l", "1"), ("I", "1"), ("S", "5"),
            # Operator lookalikes
            ("||", "="), ("|", ""),
            # Unicode math
            ("×", "*"), ("÷", "/"), ("−", "-"), ("–", "-"), ("—", "-"),
            ("²", "**2"), ("³", "**3"), ("√", "sqrt"), ("^", "**"), ("·", "*"),
            # Equals variants
            (":=", "="), (": =", "="), ("= =", "=="),
        ]
        for old, new in ocr_fixes:
            t = t.replace(old, new)

        t = re.sub(r"=+", "=", t)
        t = re.sub(r"\s*([+\-*/=])\s*", r"\1", t)
        t = re.sub(r"(\d)([a-zA-Z])", r"\1*\2", t)
        t = re.sub(r"([a-zA-Z])(\d)", r"\1*\2", t)
        t = re.sub(r"[^0-9a-zA-Z+\-*/=().*_ ]", "", t)
        t = re.sub(r"[+\-*/=]+$", "", t)

        return t.strip()
