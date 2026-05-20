"""
Text Styler - AI-powered text styling suggestions
Analyzes text content and context to suggest appropriate styling
"""

import re
from typing import Dict, List

class TextStyler:
    """
    Suggests styling for text elements based on content analysis
    """
    
    def __init__(self):
        print("Initializing Text Styler...")
        
        # Color palette for different text types
        self.colors = {
            "title": "#1971c2",      # Blue for titles
            "subtitle": "#495057",    # Gray for subtitles
            "body": "#000000",        # Black for body text
            "label": "#868e96",       # Light gray for labels
            "emphasis": "#f03e3e",    # Red for emphasis
            "success": "#37b24d",     # Green for success
            "warning": "#f59f00",     # Orange for warnings
            "code": "#5f3dc4",        # Purple for code
        }
        
        # Font sizes
        self.font_sizes = {
            "title": 36,
            "subtitle": 28,
            "heading": 24,
            "body": 20,
            "label": 16,
            "small": 14,
        }
    
    def suggest_style(self, text: str, context: Dict = None) -> Dict:
        """
        Suggest styling for text based on content and context
        
        Args:
            text: The recognized text
            context: Optional context (canvas size, nearby elements, etc.)
            
        Returns:
            Dict with styling suggestions
        """
        # Analyze text characteristics
        text_type = self._classify_text_type(text)
        
        # Base style
        style = {
            "fontSize": self.font_sizes.get(text_type, 20),
            "strokeColor": self.colors.get(text_type, "#000000"),
            "fontFamily": 1,  # Virgil (Excalidraw default)
            "textAlign": "left",
            "verticalAlign": "top",
        }
        
        # Adjust based on context
        if context:
            style = self._adjust_for_context(style, text, context)
        
        # Add metadata
        style["textType"] = text_type
        style["confidence"] = self._calculate_confidence(text, text_type)
        
        return style
    
    def _classify_text_type(self, text: str) -> str:
        """
        Classify what type of text this is
        """
        text_clean = text.strip()
        
        # Empty or very short
        if len(text_clean) < 2:
            return "label"
        
        # All caps and short = title
        if text_clean.isupper() and len(text_clean) < 30:
            return "title"
        
        # Starts with capital, short, ends with colon = heading
        if text_clean[0].isupper() and len(text_clean) < 40 and text_clean.endswith(':'):
            return "heading"
        
        # Contains code-like patterns
        if self._looks_like_code(text_clean):
            return "code"
        
        # Contains numbers and units = label
        if re.search(r'\d+\s*(px|%|em|rem|pt|ms|s|kg|m|cm)', text_clean):
            return "label"
        
        # Question mark = emphasis
        if '?' in text_clean:
            return "emphasis"
        
        # Exclamation mark = emphasis
        if '!' in text_clean:
            return "emphasis"
        
        # Success keywords
        if any(word in text_clean.lower() for word in ['done', 'complete', 'success', 'passed', '✓', '✔']):
            return "success"
        
        # Warning keywords
        if any(word in text_clean.lower() for word in ['warning', 'caution', 'alert', 'important', '⚠']):
            return "warning"
        
        # First word capitalized, medium length = subtitle
        if text_clean[0].isupper() and 10 < len(text_clean) < 50:
            return "subtitle"
        
        # Long text = body
        if len(text_clean) > 50:
            return "body"
        
        # Default
        return "body"
    
    def _looks_like_code(self, text: str) -> bool:
        """
        Check if text looks like code
        """
        code_indicators = [
            '()', '{}', '[]', '=>', '->', '==', '!=', '&&', '||',
            'function', 'const', 'let', 'var', 'def', 'class',
            'import', 'from', 'return', 'if', 'else', 'for', 'while'
        ]
        return any(indicator in text for indicator in code_indicators)
    
    def _adjust_for_context(self, style: Dict, text: str, context: Dict) -> Dict:
        """
        Adjust styling based on canvas context
        """
        # If canvas is large, use larger fonts
        if context.get('canvas_width', 0) > 1500:
            style['fontSize'] = int(style['fontSize'] * 1.2)
        
        # If text is at top of canvas, likely a title
        if context.get('y', 0) < 100:
            style['fontSize'] = max(style['fontSize'], 32)
            style['strokeColor'] = self.colors['title']
            style['textAlign'] = 'center'
        
        # If near other text elements, match their style
        if 'nearby_elements' in context:
            nearby = context['nearby_elements']
            if nearby:
                # Average font size of nearby elements
                avg_size = sum(e.get('fontSize', 20) for e in nearby) / len(nearby)
                # Don't deviate too much
                style['fontSize'] = int((style['fontSize'] + avg_size) / 2)
        
        return style
    
    def _calculate_confidence(self, text: str, text_type: str) -> float:
        """
        Calculate confidence in the classification
        """
        # Strong indicators = high confidence
        if text_type == "title" and text.isupper():
            return 0.95
        
        if text_type == "code" and self._looks_like_code(text):
            return 0.90
        
        if text_type == "success" and any(word in text.lower() for word in ['done', 'complete']):
            return 0.85
        
        # Default confidence
        return 0.75
    
    def suggest_layout_improvements(self, elements: List[Dict]) -> List[Dict]:
        """
        Suggest layout improvements for multiple text elements
        """
        suggestions = []
        
        # Group elements by type
        titles = [e for e in elements if e.get('textType') == 'title']
        bodies = [e for e in elements if e.get('textType') == 'body']
        
        # Suggest centering titles
        for title in titles:
            suggestions.append({
                "element_id": title.get('id'),
                "suggestion": "center_align",
                "reason": "Titles look better centered",
                "new_textAlign": "center"
            })
        
        # Suggest consistent spacing
        if len(elements) > 1:
            # Calculate average spacing
            y_positions = sorted([e.get('y', 0) for e in elements])
            spacings = [y_positions[i+1] - y_positions[i] for i in range(len(y_positions)-1)]
            
            if spacings and max(spacings) - min(spacings) > 50:
                suggestions.append({
                    "type": "spacing",
                    "suggestion": "consistent_spacing",
                    "reason": "Inconsistent vertical spacing detected",
                    "recommended_spacing": 40
                })
        
        return suggestions
    
    def suggest_color_palette(self, elements: List[Dict]) -> Dict:
        """
        Suggest a harmonious color palette for the canvas
        """
        # Analyze current colors
        current_colors = set(e.get('strokeColor', '#000000') for e in elements)
        
        # If too many colors, suggest simplification
        if len(current_colors) > 5:
            return {
                "suggestion": "simplify_palette",
                "reason": "Too many colors can be distracting",
                "recommended_palette": [
                    self.colors['title'],
                    self.colors['body'],
                    self.colors['emphasis']
                ]
            }
        
        # Suggest complementary colors
        return {
            "suggestion": "add_accent",
            "reason": "Add accent colors for emphasis",
            "recommended_palette": [
                self.colors['title'],
                self.colors['body'],
                self.colors['emphasis'],
                self.colors['success']
            ]
        }
