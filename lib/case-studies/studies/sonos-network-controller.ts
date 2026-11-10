import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-22",
    slug: "sonos-network-controller",
    title: "Sonos Network Controller: Keep the Music Local",
    primary_language: "Python",
    github_url: "https://github.com/fderuiter/sonos-network-controller",
    published: true,
    simulated_telemetry: false,
    tags: "python, fastapi, upnp, sonos, htmx, asyncio, reverse-engineering, iot",
    editorial_content:
      "A local **Sonos** controller built with **Python**, **FastAPI**, and **HTMX**. It talks to speakers over UPnP/SOAP and exposes a REST API for playback control on your own network.",
    architectural_narrative: `<h3>The problem</h3>
<p>Speakers on a local network can be controlled on that network. This project explores that route for Sonos, combining a Python API with a small web interface for discovering speakers and controlling playback.</p>
<p><strong>The approach:</strong> FastAPI and asyncio handle the API and network requests. UPnP/SOAP talks to the speakers, and HTMX provides the browser controls.</p>
<p><strong>Reported project measurements:</strong> Sub-25ms command response latency over local WiFi; 100% cloud-free local network execution; lightweight memory footprint under 35MB RAM on Raspberry Pi.</p>

<h3>How it works</h3>
<p>The code is layered: SOAP transport (<code>BaseSonosClient</code>) at the bottom, UPnP service clients (<code>AVTransportClient</code>, <code>RenderingControlClient</code>) above it, and audio services on top.</p>
<p>One <code>ACTION_REGISTRY</code> maps each string command to an async lambda, which replaces a long tree of endpoint routes.</p>
<p>The frontend is HTMX swapping in server-rendered Jinja2 HTML fragments, so the page updates live without a large JavaScript bundle.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    Client[Browser / HTMX Client] -->|HTTP / Form Data| Router[FastAPI Application Gateway]

    subgraph routing["Routing & Middleware"]
        Router --> ErrorDecorator["@api_error_handler Decorator"]
        Router --> Registry[Action Registry Dispatcher]
    end

    subgraph serviceLayer["Service Layer"]
        Registry --> AVService[AVTransport Client]
        Registry --> RenderService[RenderingControl Client]
        Router --> ZoneService[Zone & Topology Service]
        Router --> RadioService[Radio Service / pyradios]
    end

    subgraph hardwareIntegration["Hardware Integration"]
        AVService -->|SOAP / XML POST| SonosHW[Sonos Speaker - Port 1400]
        RenderService -->|SOAP / XML POST| SonosHW
        ZoneService -->|SOAP / XML POST| SonosHW
        Router -->|SSDP Multicast / UDP 1900| SonosHW
    end
</code></pre>

<h3>Implementation notes</h3>

<h4>Dynamic SOAP Invocation & Robust XML Extraction (<code>sonos/client.py</code>)</h4>
<pre><code class="language-python">
async def _invoke_soap_request(
    self, path: str, service_urn: str, action: str, body_content: str = ""
) -> str:
    url = f"http://{self.ip}:{self.port}{path}"
    soap_action = f"{service_urn}#{action}"
    soap_body = (
        '<?xml version="1.0"?>'
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
        's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
        "<s:Body>"
        f'<u:{action} xmlns:u="{service_urn}">'
        f"{body_content}"
        f"</u:{action}>"
        "</s:Body>"
        "</s:Envelope>"
    )
    headers = {
        "SOAPAction": f'"{soap_action}"',
        "Content-Type": "text/xml; charset=utf-8",
        "Accept-Encoding": "gzip",
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, data=soap_body.encode("utf-8")) as response:
            content = await response.text()
            if response.status >= 400:
                response.raise_for_status()
            return content
</code></pre>

<h4>Declarative Dynamic Command Routing (<code>sonos/router.py</code>)</h4>
<pre><code class="language-python">
ACTION_REGISTRY = {
    "setvolume": lambda ip, value: get_rendering_control_client(ip).set_volume(int(value)),
    "getvolume": lambda ip, value=None: get_rendering_control_client(ip).get_volume(),
    "play": lambda ip, value=None: get_av_transport_client(ip).play(),
    "pause": lambda ip, value=None: get_av_transport_client(ip).pause(),
    "seek": lambda ip, value=None: get_av_transport_client(ip).seek(value),
    "settrack": lambda ip, value: get_av_transport_client(ip).set_av_transport_uri(value),
    "status": lambda ip, value=None: get_av_transport_client(ip).get_transport_info(),
}
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li>Instead of a heavy third-party SDK, a small async UPnP/SOAP client over aiohttp fits the event loop and fails in predictable places.</li>
  <li>HTMX polling (<code>hx-trigger="every 2s"</code>) and partial DOM updates replace a client-side SPA's state machines, which keeps memory low on small hosts.</li>
  <li>Speakers are found with UDP SSDP multicast (M-SEARCH). On locked-down networks, an optional Nmap-style fallback scans port 1400 instead.</li>
</ul>`,
    created_at: new Date("2026-03-12T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
