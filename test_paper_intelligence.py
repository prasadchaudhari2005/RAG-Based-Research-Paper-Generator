import unittest
import os
import json
import tempfile
from unittest.mock import MagicMock, patch
from paper_intelligence import validate_and_clean_metadata, extract_paper_metadata
from app import app

class TestPaperIntelligence(unittest.TestCase):

    def setUp(self):
        # Configure Flask test client
        self.app = app.test_client()
        self.app.testing = True
        
        # Setup temporary directories for storage test
        self.test_dir = tempfile.TemporaryDirectory()
        
    def tearDown(self):
        self.test_dir.cleanup()

    def test_metadata_validation(self):
        # Test input with missing fields and incorrect types
        raw_data = {
            "title": "A Test Study on RAG",
            "authors": ["Author One", 123], # 123 is incorrect type (int)
            "publication_year": 2026, # int instead of string
            # key_findings, limitations etc missing
            "confidence_score": "0.85" # string instead of float
        }
        
        cleaned = validate_and_clean_metadata(raw_data)
        
        self.assertEqual(cleaned["title"], "A Test Study on RAG")
        self.assertEqual(cleaned["authors"], ["Author One", "123"])
        self.assertEqual(cleaned["publication_year"], "2026")
        self.assertEqual(cleaned["confidence_score"], 0.56) # adjusted programmatic confidence score
        self.assertEqual(cleaned["methodologies"], []) # defaulted
        self.assertEqual(cleaned["datasets"], []) # defaulted

    def test_metadata_storage(self):
        # Mock metadata
        metadata = {
            "title": "Stored Paper",
            "authors": ["A. Writer"],
            "publication_year": "2024",
            "confidence_score": 0.9
        }
        
        # Write to temporary directory
        filename = "test_paper.pdf.json"
        filepath = os.path.join(self.test_dir.name, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(metadata, f)
            
        # Read back and verify
        self.assertTrue(os.path.exists(filepath))
        with open(filepath, "r", encoding="utf-8") as f:
            read_data = json.load(f)
            
        self.assertEqual(read_data["title"], "Stored Paper")
        self.assertEqual(read_data["authors"], ["A. Writer"])

    @patch("paper_intelligence.extract_via_groq")
    @patch("paper_intelligence.GROQ_API_KEY", "dummy_key")
    @patch("paper_intelligence.GEMINI_API_KEY", "dummy_key")
    def test_metadata_extraction_fallback_and_retry(self, mock_groq):
        # Setup mock Groq to fail
        mock_groq.side_effect = Exception("Groq Rate Limit")
        
        with patch("paper_intelligence.extract_via_gemini") as mock_gemini:
            # Setup mock Gemini to succeed
            mock_gemini.return_value = {
                "title": "Gemini Extracted Paper",
                "authors": ["Gemini Author"],
                "publication_year": "2025",
                "confidence_score": 0.8
            }
            
            # Execute main function
            result = extract_paper_metadata("Some dummy PDF text content")
            
            # Should have called Groq, failed, and fell back to Gemini
            mock_groq.assert_called()
            mock_gemini.assert_called_once()
            self.assertEqual(result["title"], "Gemini Extracted Paper")

    def test_api_endpoints(self):
        # Write a dummy metadata file in metadata_store for API testing
        os.makedirs("metadata_store", exist_ok=True)
        test_meta_path = os.path.join("metadata_store", "test_endpoint_paper.pdf.json")
        
        dummy_metadata = {
            "title": "Endpoint Test Paper",
            "authors": ["Tester"],
            "publication_year": "2026",
            "confidence_score": 1.0
        }
        
        with open(test_meta_path, "w", encoding="utf-8") as f:
            json.dump(dummy_metadata, f)
            
        try:
            # Test GET /api/metadata
            res_all = self.app.get('/api/metadata')
            self.assertEqual(res_all.status_code, 200)
            data_all = json.loads(res_all.data)
            self.assertIn("test_endpoint_paper.pdf", data_all)
            
            # Test GET /api/metadata/<paper_name>
            res_single = self.app.get('/api/metadata/test_endpoint_paper.pdf')
            self.assertEqual(res_single.status_code, 200)
            data_single = json.loads(res_single.data)
            self.assertEqual(data_single["title"], "Endpoint Test Paper")
            
        finally:
            # Clean up test file
            if os.path.exists(test_meta_path):
                os.remove(test_meta_path)

if __name__ == "__main__":
    unittest.main()
