import pandas as pd
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Gemini Setup
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash')

class EmailProcessor:
    def __init__(self, file_path):
        self.file_path = file_path
        self.results = []

    def process_leads(self):
        # 1. File type check karke read karna
        extension = os.path.splitext(self.file_path)[1].lower()
        
        try:
            if extension == '.csv':
                df = pd.read_csv(self.file_path)
            elif extension in ['.xlsx', '.xls']:
                df = pd.read_excel(self.file_path)
            else:
                return {"error": "Unsupported file format"}

            # 2. Check karna ke zaruri columns hain (Name, Email, Website)
            required_columns = ['Name', 'Email', 'Website']
            if not all(col in df.columns for col in required_columns):
                return {"error": f"File must contain: {', '.join(required_columns)}"}

            # 3. Loop through each lead
            for index, row in df.iterrows():
                print(f"🔄 Processing lead {index + 1}: {row['Name']}")
                
                email_content = self.generate_bulk_email(row['Name'], row['Website'])
                
                self.results.append({
                    "name": row['Name'],
                    "email": row['Email'],
                    "content": email_content,
                    "status": "Ready to Send"
                })

            return self.results

        except Exception as e:
            return {"error": str(e)}

    def generate_bulk_email(self, name, website):
        prompt = f"""
        Target Person: {name}
        Target Company Website: {website}
        
        Task: Write a short, 3-sentence cold email. 
        Focus: Mention their website's niche and offer a quick AI automation demo.
        Format: Direct and professional. No fluff.
        """
        try:
            response = model.generate_content(prompt)
            return response.text
        except:
            return "AI Generation Failed for this lead."

# Usage Example (Ye app.py mein use hoga):
# processor = EmailProcessor('uploads/leads.xlsx')
# data = processor.process_leads()