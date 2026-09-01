from pathlib import Path
p=Path('/home/ubuntu/nox-offline-player/client/src/pages/Home.tsx')
s=p.read_text()
s=s.replace('import { useCallback, useEffect, useMemo, useRef, useState } from "react";', 'import { useCallback, useEffect, useMemo, useRef, useState } from "react";\nimport { useAuth } from "@/_core/hooks/useAuth";')
p.write_text(s)
p=Path('/home/ubuntu/nox-offline-player/server/_core/index.ts')
s=p.read_text().replace('originalName.replace(/[^\\p{L}\\p{N}._-]+/gu, "-")', 'originalName.replace(/[^A-Za-z0-9._-]+/g, "-")')
p.write_text(s)
