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

if start_idx != -1 and end_idx != -1:
    extracted = "".join(lines[start_idx:end_idx])
    print(repr(extracted))
