import urllib.request
import re

def fetch(url):
    print(f"Fetching {url}")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            links = re.findall(r'href=[\'"]([^\'"]+\.pdf)[\'"]', html, re.IGNORECASE)
            # FFD might not end in .pdf, it has links like /bulletin/45/download
            ffd_links = re.findall(r'href=[\'"]([^\'"]+/download)[\'"]', html, re.IGNORECASE)
            
            print(f"Found {len(links)} PDF links, {len(ffd_links)} download links")
            for link in (links + ffd_links)[:5]:
                print(link)
    except Exception as e:
        print(f"Error fetching {url}: {e}")

fetch("https://www.ndma.gov.pk/advisories")
fetch("https://ffd.pmd.gov.pk/bulletin/A")
