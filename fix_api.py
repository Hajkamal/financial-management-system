import re

filepath = 'src/lib/serverApi.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """const getHeaders = () => {
  const token = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SERVER_API_TOKEN) || 'ayandeh-secret-token-1405';
  return {
    'Content-Type': 'application/json',
    'x-api-token': token,
  };
};"""

content = re.sub(r'const getHeaders = \(\) => \{.*?\};', replacement, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
