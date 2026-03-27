import os
import re
import shutil

def minify_js(content):
    # Remove single-line comments
    content = re.sub(r'//.*', '', content)
    # Remove multi-line comments
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    # Strip whitespace (basic)
    return content.strip()

def minify_html(content):
    # Remove HTML comments
    content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
    # Basic whitespace reduction
    return content.strip()

def process_project(src_dir=".", dist_dir="dist"):
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    os.makedirs(dist_dir)

    # Folders to copy entirely (libraries/data)
    to_copy = ["lib", "data"]
    for folder in to_copy:
        if os.path.exists(os.path.join(src_dir, folder)):
            shutil.copytree(os.path.join(src_dir, folder), os.path.join(dist_dir, folder))

    # Folders to minify (engine)
    engine_src = os.path.join(src_dir, "engine")
    engine_dist = os.path.join(dist_dir, "engine")
    if os.path.exists(engine_src):
        os.makedirs(engine_dist)
        for filename in os.listdir(engine_src):
            if filename.endswith(".js"):
                with open(os.path.join(engine_src, filename), 'r', encoding='utf-8') as f:
                    content = f.read()
                minified = minify_js(content)
                with open(os.path.join(engine_dist, filename), 'w', encoding='utf-8') as f:
                    f.write(minified)

    # Root files
    files_to_process = {
        "index.html": minify_html,
        "app.js": minify_js,
        "style.css": lambda x: x.strip()
    }

    for filename, processor in files_to_process.items():
        if os.path.exists(os.path.join(src_dir, filename)):
            with open(os.path.join(src_dir, filename), 'r', encoding='utf-8') as f:
                content = f.read()
            processed = processor(content)
            with open(os.path.join(dist_dir, filename), 'w', encoding='utf-8') as f:
                f.write(processed)

    print(f"Obfuscation complete! Files are in the '{dist_dir}' folder.")

if __name__ == "__main__":
    process_project()
