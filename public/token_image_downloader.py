"""
https://swap.defillama.com/?chain=arbitrum&from=0x912ce59144191c1204e64559fe8253a0e49e6548&to=0x0000000000000000000000000000000000000000
"""

from bs4 import BeautifulSoup
import json, requests, os
from pathlib import Path

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
}
# Assuming 'html_content' contains the HTML source you are parsing
html_content = requests.get("https://swap.defillama.com/", headers=headers).text

# Parse the HTML content
soup = BeautifulSoup(html_content, "html.parser")

# Find the <script> tag with the specific id
script_tag = soup.find("script", {"id": "__NEXT_DATA__"})

if script_tag:
    # Extract the JSON string
    json_string = script_tag.string

    # Parse the JSON string into a Python dictionary
    token_dictionary = json.loads(json_string)
    saved_tokens = set()
    for chain_id, tokens in token_dictionary["props"]["pageProps"]["tokenList"].items():
        for idx, token_dict in enumerate(tokens):
            symbol = token_dict["symbol"].lower()
            if "/" in symbol:
                symbol = symbol.replace("/", "-")
            address = token_dict["address"]
            if symbol in saved_tokens and token_dict.get("logoURI2") == None:
                # or token_dict['volume24h'] == 0:
                print("skipping", symbol)
                continue
            saved_tokens.add(symbol)
            print("progress:", idx / len(tokens) * 100, "%")

            logo_url = (
                token_dict["logoURI2"]
                if token_dict.get("logoURI2")
                else token_dict["logoURI"]
            )
            img_data = requests.get(logo_url).content
            img_name = os.path.join("./tokenPictures", f"{symbol}.webp")
            with open(img_name, "wb") as file:
                file.write(img_data)
