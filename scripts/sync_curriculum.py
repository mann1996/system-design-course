import json
import re
import os

with open('curriculum.json', 'r') as f:
    curriculum = json.load(f)

# Flatten lessons
all_lessons = []
for mod in curriculum['modules']:
    for les in mod['lessons']:
        les['module'] = mod
        all_lessons.append(les)

references = curriculum['references']

def get_lessons_dropdown(is_subfolder):
    prefix = "lessons/" if not is_subfolder else ("" if is_subfolder == "lessons" else "../lessons/")
    items = []
    for l in all_lessons:
        href = f"{prefix}{l['filename']}"
        items.append(f"""            <li class="nav-dropdown-item">
              <a href="{href}">
                <span class="nav-item-num">{l['badge']}</span>
                <span class="nav-item-title">{l['navTitle']}</span>
              </a>
            </li>""")
    return "\n".join(items)

def get_references_dropdown(is_subfolder):
    prefix = "reference/" if not is_subfolder else ("" if is_subfolder == "reference" else "../reference/")
    items = []
    for r in references:
        href = f"{prefix}{r['filename']}"
        items.append(f"""            <li class="nav-dropdown-item">
              <a href="{href}">
                <span class="nav-item-num">{r['badge']}</span>
                <span class="nav-item-title">{r['navTitle']}</span>
              </a>
            </li>""")
    return "\n".join(items)

def get_footer_html(is_subfolder):
    l_prefix = "lessons/" if not is_subfolder else ("" if is_subfolder == "lessons" else "../lessons/")
    r_prefix = "reference/" if not is_subfolder else ("" if is_subfolder == "reference" else "../reference/")
    c_href = "index.html" if not is_subfolder else "../index.html"
    res_href = "RESOURCES.md" if not is_subfolder else "../RESOURCES.md"

    l_items = [f'            <li><a href="{c_href}">Course Overview</a></li>']
    for l in all_lessons:
        href = f"{l_prefix}{l['filename']}"
        l_items.append(f'            <li><a href="{href}">{l["id"]}: {l["navTitle"]}</a></li>')
    les_html = "\n".join(l_items)

    r_items = []
    for r in references:
        href = f"{r_prefix}{r['filename']}"
        r_items.append(f'            <li><a href="{href}">{r["title"]}</a></li>')
    r_items.append(f'            <li><a href="{res_href}">Primary Sources</a></li>')
    ref_html = "\n".join(r_items)

    return f"""  <!-- Dark Navy Footer (DESIGN.md footer) -->
  <footer class="footer-dark">
    <div class="footer-inner">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="footer-brand-title">
            <svg class="brand-spike" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="color: var(--color-on-dark);">
              <path d="M12 0c.5 6.6 5.4 11.5 12 12-6.6.5-11.5 5.4-12 12-.5-6.6-5.4-11.5-12-12 6.6-.5 11.5-5.4 12-12z"/>
            </svg>
            <span>Teach Me: System Design</span>
          </div>
          <p class="footer-desc">
            An interactive, pedagogical curriculum designed to turn developers into authoritative software architects who make sound distributed system decisions.
          </p>
        </div>

        <div class="footer-col">
          <h5>Curriculum</h5>
          <ul class="footer-links">
{les_html}
          </ul>
        </div>

        <div class="footer-col">
          <h5>Reference</h5>
          <ul class="footer-links">
{ref_html}
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <div>Advanced System Design &bull; Warm Editorial Design System</div>
        <div>Ground truth based on Martin Kleppmann &amp; Alex Xu</div>
      </div>
    </div>
  </footer>"""

def replace_footer(content, is_subfolder):
    footer_html = get_footer_html(is_subfolder)
    return re.sub(
        r'(<!--\s*Dark Navy Footer[\s\S]*?-->\s*)?<footer[\s\S]*?</footer>',
        footer_html,
        content
    )

# Update index.html
def update_index():
    with open('index.html', 'r') as f:
        content = f.read()

    # Dropdowns
    les_dd = get_lessons_dropdown(None)
    ref_dd = get_references_dropdown(None)
    
    content = re.sub(
        r'(<!-- Lessons Dropdown -->[\s\S]*?<ul class="nav-dropdown-menu">)[\s\S]*?(</ul>\s*</div>\s*<!-- Reference Sheets Dropdown -->)',
        r'\1\n' + les_dd + r'\n          \2',
        content
    )
    content = re.sub(
        r'(<!-- Reference Sheets Dropdown -->[\s\S]*?<ul class="nav-dropdown-menu">)[\s\S]*?(</ul>\s*</div>\s*</div>)',
        r'\1\n' + ref_dd + r'\n          \2',
        content
    )

    # Footer
    content = replace_footer(content, None)

    # Module Sections in Index Body
    module_sections = []
    for mod in curriculum['modules']:
        cards = []
        for l in mod['lessons']:
            cards.append(f"""        <a href="lessons/{l['filename']}" class="lesson-card">
          <div>
            <div class="badge-row">
              <span class="badge badge-coral">{l['badge']}</span>
              <span class="badge">{l['time']}</span>
              <span class="badge badge-teal">{l['tag']}</span>
            </div>
            <h3>{l['title']}</h3>
            <p>
              {l['summary']}
            </p>
          </div>
          <div class="lesson-meta">
            <span>Read Lesson</span>
            <span>&rarr;</span>
          </div>
        </a>""")
        cards_html = "\n\n".join(cards)
        module_sections.append(f"""      <h2>Module {mod['number']}: {mod['title']}</h2>
      <p>
        {mod['description']}
      </p>

      <div class="curriculum-grid">
{cards_html}
      </div>""")

    all_modules_html = "\n\n".join(module_sections)

    content = re.sub(
        r'<h2>Module 1:[\s\S]*?(?=<h2>Permanent Reference Sheets</h2>)',
        all_modules_html + "\n\n      ",
        content
    )

    with open('index.html', 'w') as f:
        f.write(content)
    print("Updated index.html")

# Update lessons
def update_lessons():
    les_dd = get_lessons_dropdown("lessons")
    ref_dd = get_references_dropdown("lessons")

    # Also update TEMPLATE.html
    template_path = os.path.join("lessons", "TEMPLATE.html")
    if os.path.exists(template_path):
        with open(template_path, 'r') as f:
            t_content = f.read()
        t_content = replace_footer(t_content, "lessons")
        with open(template_path, 'w') as f:
            f.write(t_content)
        print("Updated lesson template")

    for l in all_lessons:
        filepath = os.path.join("lessons", l['filename'])
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'r') as f:
            content = f.read()

        # Update module badge in header
        correct_mod_badge = f'<span class="badge">{l["module"]["badge"]}</span>'
        content = re.sub(
            r'<span class="badge">Module\s*\d+[^<]*</span>',
            correct_mod_badge,
            content
        )

        # Update Dropdowns
        content = re.sub(
            r'(<!-- Lessons Dropdown -->[\s\S]*?<ul class="nav-dropdown-menu">)[\s\S]*?(</ul>\s*</div>\s*<!-- Reference Sheets Dropdown -->)',
            r'\1\n' + les_dd + r'\n          \2',
            content
        )
        content = re.sub(
            r'(<!-- Reference Sheets Dropdown -->[\s\S]*?<ul class="nav-dropdown-menu">)[\s\S]*?(</ul>\s*</div>\s*</div>)',
            r'\1\n' + ref_dd + r'\n          \2',
            content
        )

        # Update Footer
        content = replace_footer(content, "lessons")

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated lesson: {l['filename']}")

# Update reference sheets
def update_references():
    les_dd = get_lessons_dropdown("reference")
    ref_dd = get_references_dropdown("reference")

    # Also update TEMPLATE.html
    template_path = os.path.join("reference", "TEMPLATE.html")
    if os.path.exists(template_path):
        with open(template_path, 'r') as f:
            t_content = f.read()
        t_content = replace_footer(t_content, "reference")
        with open(template_path, 'w') as f:
            f.write(t_content)
        print("Updated reference template")

    for r in references:
        filepath = os.path.join("reference", r['filename'])
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'r') as f:
            content = f.read()

        # Update Dropdowns
        content = re.sub(
            r'(<!-- Lessons Dropdown -->[\s\S]*?<ul class="nav-dropdown-menu">)[\s\S]*?(</ul>\s*</div>\s*<!-- Reference Sheets Dropdown -->)',
            r'\1\n' + les_dd + r'\n          \2',
            content
        )
        content = re.sub(
            r'(<!-- Reference Sheets Dropdown -->[\s\S]*?<ul class="nav-dropdown-menu">)[\s\S]*?(</ul>\s*</div>\s*</div>)',
            r'\1\n' + ref_dd + r'\n          \2',
            content
        )

        # Update Footer
        content = replace_footer(content, "reference")

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated reference: {r['filename']}")

update_index()
update_lessons()
update_references()
