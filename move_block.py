with open("app/preview/[slug]/page.tsx", "r") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if "STREAM PLAYER LAUNCHER CALLOUT" in line:
        start_idx = i
    if "VENUE / EVENT DETAILS" in line:
        end_idx = i
        break

extracted = lines[start_idx:end_idx]
del lines[start_idx:end_idx]

# Find Match Facts
match_facts_idx = -1
for i, line in enumerate(lines):
    if "{/* Facts / Pre-match */}" in line:
        match_facts_idx = i
        break

if match_facts_idx != -1:
    # Change styles of extracted block to fit new context
    for i in range(len(extracted)):
        if "bg-white border border-neutral-200/70" in extracted[i]:
            extracted[i] = extracted[i].replace("bg-white border border-neutral-200/70", "bg-neutral-50/50 border border-neutral-100")
            extracted[i] = extracted[i].replace("p-5 md:p-6", "p-4 md:p-5")
    
    # insert
    for i, line in enumerate(extracted):
        lines.insert(match_facts_idx + i, line)
    
    with open("app/preview/[slug]/page.tsx", "w") as f:
        f.writelines(lines)
    print("Success")
else:
    print("Match facts not found")
