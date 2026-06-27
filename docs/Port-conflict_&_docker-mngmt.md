Here are the easiest ways to manage Docker containers on Ubuntu, from simplest to most powerful.

## CLI essentials

The basics cover 90% of daily use:

```bash
docker ps                    # running containers
docker ps -a                 # all containers (incl. stopped)
docker start <name|id>
docker stop <name|id>
docker restart <name|id>
docker rm <name|id>          # remove (add -f to force)
docker logs -f <name|id>     # tail logs
docker stats                 # live CPU/mem/net per container
docker exec -it <name> bash  # shell into a container
docker update --restart=no <name>   # disable autostart
docker system prune -a       # reclaim disk (careful)
```

For multi-container apps, `docker compose` (built into modern Docker) is the go-to: `docker compose up -d`, `down`, `ps`, `logs -f`.

## Terminal UI (recommended)

**lazydocker** — keyboard-driven TUI, my top pick for Ubuntu. See containers, logs, stats, restart, exec, prune — all without typing commands.

```bash
sudo snap install lazydocker
# or via Go: go install github.com/jesseduffield/lazydocker@latest
lazydocker
```

**ctop** — `htop`-style live view of containers:

```bash
sudo wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop
sudo chmod +x /usr/local/bin/ctop
ctop
```

## Web/Desktop GUIs

- **Portainer** — full-featured web UI; runs as a container itself:
  ```bash
  docker volume create portainer_data
  docker run -d -p 9443:9443 --name portainer --restart=always \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v portainer_data:/data portainer/portainer-ce:latest
  ```
  Then open https://localhost:9443.
- **Docker Desktop for Linux** — official GUI from Docker; install the `.deb` from docker.com. Heavier (runs a VM) but familiar if you've used it on Mac/Windows.
- **VS Code / Cursor Docker extension** — tree view of containers/images/volumes with right-click actions. Good if you live in the editor.

## Autostart control

Restart policies are how you control auto-start on boot (because Docker itself starts at boot via systemd):

```bash
docker update --restart=no       <name>   # never auto-start
docker update --restart=unless-stopped <name>  # start unless you stopped it
docker update --restart=always   <name>
docker update --restart=on-failure:5 <name>
```

To stop the Docker daemon itself from running at boot:
```bash
sudo systemctl disable docker.service docker.socket
sudo systemctl stop docker.service docker.socket
```

## Quick recommendation

For your workflow (occasional dev containers competing for ports): install **lazydocker** for fast triage, and use `docker update --restart=no` on anything you don't want auto-starting. Add **Portainer** later if you want a browser dashboard.