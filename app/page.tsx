"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const featureDescriptions: Record<string, string> = {
  "OS MODEL": `<strong class="blue">Model wrapping</strong> is the process of taking an <strong class="green">open-source</strong> <strong class="blue">AI model</strong> from <strong class="orange">HuggingFace</strong> and adding essential features like chat interfaces, APIs, <strong class="green">long-term</strong> <strong class="blue">memory</strong>, function calling, and multimodal capabilities to make it fully interactive.<br><br>
  <strong class="red">Services</strong> like <strong class="red">ChatGPT</strong> and <strong class="red">Claude</strong> wrap their <strong class="blue">core models</strong> with these features, turning them into <strong>full AI assistants</strong>, while <strong class="green">open-source</strong> <strong class="orange">models</strong> like <strong class="orange">LLaMA</strong>, <strong class="orange">Mixtral</strong>, or <strong class="orange">Phi</strong> require external infrastructure to achieve the same functionality.<br><br>
  <strong class="green">Go-Wrap</strong> provides this infrastructure, enabling any <strong class="green">open-source</strong> <strong class="blue">model</strong> <strong>to match the capabilities of <strong class="red">proprietary</strong> AI assistants</strong> while maintaining full control over data, customization, and transfer learning.<br><br>
  <strong class="green">By</strong> managing versioning and continuous <strong class="green">fine-tuning</strong>, <strong class="green">Go-Wrap</strong> ensures <strong class="blue">model</strong> <strong class="red">evolution</strong> is <strong class="blue">maintained</strong> through <strong class="green">long-term</strong> <strong class="red">care</strong>, making <strong class="green">open-source</strong> <strong class="blue">AI</strong> <strong class="green">feature-complete</strong>, <strong class="green">self-improving</strong> and <strong class="blue">reliably yours</strong>.`,
  "SERVERLESS CHAT API":
    "A chat API for interacting with any bots you create. Uses modal.com for serverless AI infrastructure.",
  "CHAT INTERFACE":
    "We provide a conversational chat interface for interacting with any bots you create.",
  "FUNCTION CALLING":
    "Give your model function calling capabilities to interact with the world. Write your own plugins.",
  "LONG TERM MEMORY":
    "The model knows what it knows. It can remember things over time.",
  LOGS: "Record events and messages for tracking, debugging, insights, and future distillation.",
  "SELF-MANAGED DATABASES":
    "The model can manage its own vector and relational databases. Users may review and edit.",
  "SELF-REFINING CAPABILITIES":
    "With help from user feedback, the model reaches for truth and grows.",
  "TRANSFER LEARNING":
    "Review the transfer learning process. Setup timers. Check version history. Perform evals.",
  "OBJECTIVE GUIDANCE":
    "Models are trained to identify user learning objectives and guide them towards them while solving distraction trajectories.",
  "PROJECTS ASSIGNMENTS":
    "Models are trained in managing projects, assignments, assets and liabilities. They can help you manage your life.",
  "AGENTIC CHANNELS":
    "Multiple AIs with different tasks and personality can interact together in a shared environment.",
  "DISCORD SUPPORT":
    "Get help and interact with the community directly on Discord.",
};

type Point = {
  x: number;
  y: number;
  x0: number;
  y0: number;
  t0: number;
};

export default function Home() {
  const svgRef = useRef<SVGSVGElement>(null);
  const featureDialogRef = useRef<HTMLDialogElement>(null);
  const waitlistDialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [feature, setFeature] = useState("OS MODEL");
  const [coloredPieces, setColoredPieces] = useState(0);
  const [rainbow, setRainbow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [completionSize, setCompletionSize] = useState({ width: 0, height: 0 });
  const [gameMode, setGameMode] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(1);

  const playSound = (file: string) => {
    const audio = new Audio(`/${file}`);
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const yStep = 58;
    const segmentLength = 90;
    const angle = 20;
    const color1 = "#d9dbe2";
    const color2 = "#e9e9e9";

    let lines: Point[][] = [];
    let lineAlternator = 1;
    let animationFrame = 0;
    let revealed = false;
    let lastTime = performance.now();

    let width = window.innerWidth;
    let height = window.innerHeight;

    const generateZigzagPattern = () => {
      lines = [];
      svg.innerHTML = "";

      const rows = Math.ceil(height / yStep);
      const cols = Math.ceil(width / segmentLength);

      for (let i = 0; i < rows; i++) {
        const yOffset = i * yStep;
        const color = i % 2 === 0 ? color1 : color2;
        const points: Point[] = [];
        let x = 0;
        let y = yOffset;
        lineAlternator = 1;

        for (let j = 0; j < cols; j++) {
          const xNext = x + segmentLength;
          const triangleWave =
            lineAlternator * segmentLength * Math.tan((angle * Math.PI) / 180);

          lineAlternator *= -1;

          const lerpY = Math.max(0, Math.min(xNext / width, 1));
          const sineWave = Math.sin(lerpY * (Math.PI / 2)) * triangleWave;
          const yNext = yOffset + sineWave / 2;

          points.push({
            x,
            y,
            x0: x,
            y0: y,
            t0: Date.now(),
          });

          x = xNext;
          y = yNext;
        }

        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );

        path.setAttribute(
          "d",
          `M 0 ${yOffset} ` + points.map((p) => `L ${p.x} ${p.y}`).join(" "),
        );
        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", "40");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("class", "zigzag-line");

        svg.appendChild(path);
        lines.push(points);
      }
    };

    const createNewColumn = () => {
      for (let i = 0; i < lines.length; i++) {
        const points = lines[i];
        const prevX = points[points.length - 1].x;
        const xNext = prevX + segmentLength;
        const prevY = points[points.length - 1].y;
        const middleY = i * yStep;

        lineAlternator = prevY < middleY ? 1 : -1;

        const triangleWave =
          lineAlternator * segmentLength * Math.tan((angle * Math.PI) / 180);

        const yNext = middleY + triangleWave / 2;

        points.push({
          x0: xNext,
          y0: yNext,
          x: xNext,
          y: yNext,
          t0: Date.now(),
        });
      }

      lineAlternator *= -1;
    };

    const removeFrontColumn = () => {
      lines.forEach((line) => line.shift());
    };

    const updateLines = () => {
      let createNew = false;
      let removeFront = false;

      for (let i = 0; i < lines.length; i++) {
        const points = lines[i];
        const middleY = i * yStep;

        for (let j = 0; j < points.length; j++) {
          const t = (Date.now() - points[j].t0) / 1000;

          points[j].x = points[j].x0 - t * 30 - Math.exp(t * 0.14);

          const initialY = points[j].y0;
          const lerpY = Math.max(0, Math.min(points[j].x / width, 1));

          points[j].y =
            (initialY - middleY) * Math.sin(lerpY * (Math.PI / 2)) + middleY;
        }

        if (points[points.length - 1].x < width + segmentLength) {
          createNew = true;
        }

        if (points[0].x < -segmentLength * 20) {
          removeFront = true;
        }
      }

      if (createNew) createNewColumn();
      if (removeFront) removeFrontColumn();
    };

    const rerenderLines = () => {
      for (let i = 0; i < lines.length; i++) {
        const points = lines[i];

        const pathData = points
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
          )
          .join(" ");

        svg.children[i]?.setAttribute("d", pathData);
      }
    };

    const loop = () => {
      animationFrame = requestAnimationFrame(loop);
      updateLines();
      rerenderLines();
    };

    const reveal = () => {
      if (revealed) return;

      revealed = true;
      lastTime = performance.now();

      generateZigzagPattern();
      loop();
    };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      if (revealed) {
        generateZigzagPattern();
      }
    };

    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "e") {
        setGameMode(true);
        setPlayerIndex(1);

        const table = document.querySelector(".table");
        table?.querySelectorAll<HTMLElement>("div").forEach((div) => {
          div.style.backgroundColor = "rgb(223, 255, 225)";
        });

        if (table?.children[1]) {
          (table.children[1] as HTMLElement).style.backgroundColor =
            "rgb(255, 222, 231)";
        }
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyboard);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  useEffect(() => {
    if (!gameMode) return;

    const handleKeyboard = (e: KeyboardEvent) => {
      const table = document.querySelector(".table");
      if (!table) return;

      let next = playerIndex;

      if (e.key === "ArrowUp") next -= 4;
      else if (e.key === "ArrowDown") next += 4;
      else if (e.key === "ArrowRight") next += 1;
      else if (e.key === "ArrowLeft") next -= 1;
      else return;

      e.preventDefault();

      if (e.key === "ArrowUp" && next < 0) next += 4;
      if (e.key === "ArrowDown" && next > 11) next -= 4;
      if (e.key === "ArrowRight" && next % 4 === 0) next -= 4;
      if (e.key === "ArrowLeft" && next < 0) next = 3;
      else if (e.key === "ArrowLeft" && next % 4 === 3) next += 4;

      (table.children[playerIndex] as HTMLElement).style.backgroundColor =
        "rgb(223, 255, 225)";

      (table.children[next] as HTMLElement).style.backgroundColor =
        "rgb(255, 222, 231)";

      setPlayerIndex(next);
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [gameMode, playerIndex]);

  const openFeature = (name: string) => {
    const normalized = name.replace(/\n+/g, " ").trim();
    setFeature(normalized);
    featureDialogRef.current?.showModal();
  };

  const handleFeatureClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const name = target.innerText.replace(/\n+/g, " ").trim();

    openFeature(name);

    const currentColor = target.style.backgroundColor;

    if (!currentColor) {
      target.style.backgroundColor = "rgb(223, 255, 225)";
      setColoredPieces((count) => {
        const next = count + 1;
        if (next === 13) playSound("pew.wav");
        return next;
      });
    } else if (currentColor === "rgb(223, 255, 225)") {
      target.style.backgroundColor = "rgb(250, 234, 214)";
    } else if (currentColor === "rgb(250, 234, 214)") {
      target.style.backgroundColor = "rgb(255, 222, 231)";
    } else {
      target.style.backgroundColor = "";
      setColoredPieces((count) => Math.max(0, count - 1));
    }
  };

  useEffect(() => {
    setRainbow(coloredPieces === 13);
  }, [coloredPieces]);

  const handleWaitlist = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formRef.current) return;

    setSubmitting(true);

    const values = Object.fromEntries(new FormData(formRef.current).entries());

    try {
      const res = await fetch("https://api.getwaitlist.com/api/v1/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          waitlist_id: 25733,
          metadata: {
            first_name: values.firstName,
            last_name: values.lastName,
            suggestions: values.suggestions,
            website: values.website,
            coloredPieces,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Waitlist submission failed.");
      }

      const waitWrap = formRef.current.getBoundingClientRect();

      setCompletionSize({
        width: (waitWrap.width * 11) / 16,
        height: (waitWrap.height * 11) / 16,
      });

      setSubmitted(true);
      formRef.current.reset();
      playSound("chirp.wav");
    } catch (error) {
      console.error(error);
      alert("Unable to join the waitlist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeOnBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.close();
    }
  };

  const handleDialogClose = () => {
    playSound("swipe+place.wav");
  };

  useEffect(() => {
    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const interactive = target.closest("button, a, .td");
      if (!interactive) return;

      if (
        event.relatedTarget instanceof Node &&
        interactive.contains(event.relatedTarget)
      )
        return;

      new Audio("/bloop.wav").play().catch(() => {});
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("button, a, .td")) return;

      new Audio("/tap.wav").play().catch(() => {});
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <>
      <div id="background">
        <svg id="zigzag-svg" ref={svgRef} />
        <div id="tint" />
        <div id="gradient" />
      </div>

      <div className="page">
        <div className="container-socials-wrap">
          <div className="container">
            <h1>WELCOME TO GO-WRAP</h1>

            <div className="subtitle">
              <h2>
                WRAP ANY{" "}
                <a
                  className="model-wrapping-link"
                  onClick={() => openFeature("OS MODEL")}
                >
                  OS MODEL
                </a>
                .
              </h2>

              <h2>
                BECOME{" "}
                <span className={rainbow ? "rainbow-text" : ""}>
                  FEATURE COMPLETE
                </span>
                .
              </h2>
            </div>

            <div className="table">
              {Object.keys(featureDescriptions)
                .filter((name) => name !== "OS MODEL")
                .map((name) => (
                  <div className="td" key={name} onClick={handleFeatureClick}>
                    {name === "SERVERLESS CHAT API" ? (
                      <>
                        SERVERLESS
                        <br />
                        CHAT API
                      </>
                    ) : name === "CHAT INTERFACE" ? (
                      <>
                        CHAT
                        <br />
                        INTERFACE
                      </>
                    ) : name === "FUNCTION CALLING" ? (
                      <>
                        FUNCTION
                        <br />
                        CALLING
                      </>
                    ) : name === "LONG TERM MEMORY" ? (
                      <>
                        LONG TERM
                        <br />
                        MEMORY
                      </>
                    ) : name === "SELF-MANAGED DATABASES" ? (
                      <>
                        SELF-MANAGED
                        <br />
                        DATABASES
                      </>
                    ) : name === "SELF-REFINING CAPABILITIES" ? (
                      <>
                        SELF-REFINING
                        <br />
                        CAPABILITIES
                      </>
                    ) : name === "TRANSFER LEARNING" ? (
                      <>
                        TRANSFER
                        <br />
                        LEARNING
                      </>
                    ) : name === "OBJECTIVE GUIDANCE" ? (
                      <>
                        OBJECTIVE
                        <br />
                        GUIDANCE
                      </>
                    ) : name === "PROJECTS ASSIGNMENTS" ? (
                      <>
                        PROJECTS
                        <br />
                        ASSIGNMENTS
                      </>
                    ) : name === "AGENTIC CHANNELS" ? (
                      <>
                        AGENTIC
                        <br />
                        CHANNELS
                      </>
                    ) : name === "DISCORD SUPPORT" ? (
                      <>
                        DISCORD
                        <br />
                        SUPPORT
                      </>
                    ) : (
                      name
                    )}
                  </div>
                ))}
            </div>

            <div className="buttons">
              <button
                onClick={() => {
                  setSubmitted(false);
                  waitlistDialogRef.current?.showModal();
                }}
              >
                <span>WAIT</span>
              </button>

              <button disabled className="sub-button">
                <span>GO</span>
              </button>
            </div>
          </div>

          <div className="socials">
            <div className="footer">
              <a
                className="handle"
                href="https://x.com/tay2win"
                target="_blank"
                rel="noopener noreferrer"
              >
                @taylorgoolsby
              </a>
            </div>

            <div className="flex row">
              <a
                href="https://bento.me/taylorgoolsby"
                target="_blank"
                rel="noopener noreferrer"
                className="icon heart"
                style={{ marginRight: "16px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path
                    d="M12 4.435c-1.989-5.399-12-4.597-12 3.568 0 4.068 3.06 9.481 12 14.997 8.94-5.516 12-10.929 12-14.997 0-8.118-10-8.999-12-3.568z"
                    fill="#222227"
                    fillOpacity="0.29"
                  />
                </svg>
              </a>

              <a
                className="icon"
                href="https://github.com/taylorgoolsby/go-wrap"
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginRight: "16px" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.00002 0.558136C3.35269 0.558136 0.395081 3.51509 0.395081 7.16307C0.395081 10.0814 2.2876 12.5571 4.91194 13.4306C5.24192 13.4918 5.36311 13.2873 5.36311 13.1129C5.36311 12.9554 5.35699 12.4352 5.35414 11.8832C3.51664 12.2827 3.12891 11.1039 3.12891 11.1039C2.82846 10.3404 2.39555 10.1374 2.39555 10.1374C1.79617 9.72748 2.44072 9.73601 2.44072 9.73601C3.10386 9.7825 3.45321 10.4167 3.45321 10.4167C4.0423 11.4262 4.99835 11.1343 5.37525 10.9657C5.43453 10.5386 5.60571 10.2471 5.7946 10.0824C4.32755 9.9156 2.78525 9.34915 2.78525 6.81832C2.78525 6.09721 3.04338 5.50801 3.46589 5.04535C3.39721 4.8791 3.17113 4.20732 3.52977 3.29754C3.52977 3.29754 4.0843 3.12003 5.34649 3.97457C5.87346 3.82812 6.4386 3.754 7.00002 3.752C7.56111 3.754 8.12658 3.8279 8.65453 3.97435C9.91519 3.11981 10.4691 3.29732 10.4691 3.29732C10.8286 4.207 10.6024 4.87889 10.5339 5.04514C10.9574 5.50779 11.2137 6.097 11.2137 6.8181C11.2137 9.35495 9.66855 9.91342 8.19778 10.077C8.4348 10.282 8.64589 10.6841 8.64589 11.3002C8.64589 12.1839 8.63824 12.8952 8.63824 13.1127C8.63824 13.2885 8.75711 13.4945 9.09192 13.4296C11.7147 12.5553 13.6051 10.0803 13.6051 7.16307C13.605 3.51531 10.6477 0.558136 7.00002 0.558136Z"
                    fill="#222227"
                    fillOpacity="0.29"
                  />
                </svg>
              </a>

              <a
                className="icon discord"
                href="https://discord.gg/CPpB8H6SJr"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 512 512"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="256"
                    cy="256"
                    r="256"
                    fill="#222227"
                    fillOpacity="0.29"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="footer future">
          DESIGNED FOR:
          <br />
          - WRAPPING OPEN-SOURCE MODELS
          <br />
          - BUILDING AI KNOWLEDGE BASES
          <br />- DEVELOPING EVOLVING AI BOTS
        </div>
      </div>

      <dialog
        id="feature-dialog"
        ref={featureDialogRef}
        onClick={closeOnBackdrop}
        onClose={handleDialogClose}
      >
        <div
          className={`go-wrap feature-dialog-wrap ${
            feature === "OS MODEL" ? "model-wrapping-dialog-wrap" : ""
          }`}
        >
          <span className="feature-dialog-title">
            {feature === "OS MODEL" ? (
              <>
                WHAT IS <strong className="blue">MODEL WRAPPING</strong>?
              </>
            ) : (
              feature
            )}
          </span>

          <span
            className="feature-dialog-description"
            dangerouslySetInnerHTML={{
              __html: featureDescriptions[feature] ?? "",
            }}
          />
        </div>
      </dialog>

      <dialog
        id="waitlist-dialog"
        ref={waitlistDialogRef}
        onClick={closeOnBackdrop}
        onClose={handleDialogClose}
      >
        {submitted ? (
          <div
            className="go-wrap completion"
            style={{
              display: "flex",
              width: completionSize.width,
              height: completionSize.height,
            }}
          >
            <span>THANK YOU FOR JOINING THE WAITLIST</span>
            <span>WE WILL NOTIFY YOU WHEN WE ARE READY</span>
          </div>
        ) : (
          <form
            id="wait-wrap"
            className="go-wrap"
            ref={formRef}
            onSubmit={handleWaitlist}
          >
            <span className="form-title">WAITLIST</span>

            <div className="flex row">
              <label htmlFor="firstName">FIRST NAME: </label>
              <input type="text" id="firstName" name="firstName" required />
            </div>

            <div className="flex row">
              <label htmlFor="lastName">LAST NAME: </label>
              <input type="text" id="lastName" name="lastName" required />
            </div>

            <div className="flex row">
              <label htmlFor="email">EMAIL: </label>
              <input type="email" id="email" name="email" required />
            </div>

            <div className="flex row">
              <label htmlFor="website">WEBSITE: </label>
              <input type="text" id="website" name="website" />
            </div>

            <div className="flex row">
              <label htmlFor="suggestions">
                WHAT CAN AI
                <br />
                DO FOR YOU?
              </label>
              <textarea
                id="suggestions"
                name="suggestions"
                maxLength={300}
                placeholder="Can it ..."
              />
            </div>

            <button
              type="submit"
              className="small-button"
              disabled={submitting}
            >
              {submitting ? "SENDING..." : "JOIN"}
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
