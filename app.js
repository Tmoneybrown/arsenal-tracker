(function () {
  "use strict";

  var boot = document.getElementById("boot");
  var sections = document.getElementById("sections");

  if (location.protocol === "file:") {
    showBoot(
      "Open this page through a local server so data.json can load. From the repo folder run: python3 -m http.server 8080 — then visit http://localhost:8080",
      true
    );
    return;
  }

  load();

  function load() {
    fetch("data.json", { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("data.json returned " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        assertData(data);
        render(data);
        boot.hidden = true;
        sections.hidden = false;
        watchNav();
      })
      .catch(function (error) {
        showBoot("Could not load data.json. " + error.message, true);
      });
  }

  function assertData(data) {
    ["arsenal", "ammo", "wishlist", "carry", "magMap", "notes"].forEach(function (key) {
      if (!data || data[key] == null) {
        throw new Error('missing "' + key + '"');
      }
    });
    if (!data.wishlist.tiers || !data.wishlist.nonGlock) {
      throw new Error("wishlist tiers or non-Glock list is missing");
    }
  }

  function render(data) {
    if (data.meta && data.meta.title) {
      document.title = data.meta.title;
    }
    var tagline = document.querySelector(".tagline");
    if (tagline && data.meta && data.meta.tagline) {
      tagline.textContent = data.meta.tagline;
    }
    fill("dashboard", function () {
      return renderDashboard(data);
    });
    fill("arsenal", function () {
      return renderArsenal(data);
    });
    fill("ammo", function () {
      return renderAmmo(data);
    });
    fill("wishlist", function () {
      return renderWishlist(data);
    });
    fill("carry", function () {
      return renderCarry(data);
    });
    fill("mag-map", function () {
      return renderMagMap(data);
    });
    fill("notes", function () {
      return renderNotes(data);
    });
  }

  function fill(name, builder) {
    var mount = document.querySelector('[data-mount="' + name + '"]');
    if (!mount) return;
    mount.replaceChildren();
    try {
      var node = builder();
      if (node) mount.append(node);
    } catch (error) {
      mount.append(el("p", { class: "error", text: "Could not render this section. " + error.message }));
    }
  }

  function renderDashboard(data) {
    var owned = (data.arsenal || []).filter(function (gun) {
      return String(gun.status || "").toLowerCase() === "owned";
    });
    var next = findItem(data, data.dashboard && data.dashboard.nextPlannedBuyId);
    var total = knownTotal(data);
    var ammoRows = data.ammo || [];
    var enteredCount = ammoRows.filter(function (row) {
      return ammoState(row, goalDefault(data)).entered;
    }).length;
    var ammoSummary = enteredCount === 0
      ? "Counts are not entered yet."
      : enteredCount + " of " + ammoRows.length + " calibers have counts entered.";

    var grid = el("div", { class: "stat-grid" }, [
      el("article", { class: "card" }, [
        el("span", { class: "price-label", text: "Guns owned" }),
        el("span", { class: "stat-value", text: String(owned.length) }),
        el("p", {
          class: "substat",
          text: owned.map(function (gun) { return gun.name; }).join(" · ") || "None listed"
        })
      ]),
      el("article", { class: "card" }, [
        el("span", { class: "price-label", text: "Next planned buy" }),
        el("span", {
          class: "stat-value stat-text",
          text: next ? next.name : "Not set"
        })
      ]),
      el("article", { class: "card stat-span" }, [
        el("span", { class: "price-label", text: "Wishlist total of known prices" }),
        total.complete
          ? el("span", {
            class: "stat-value",
            "data-known-total": "true",
            text: formatMoney(total.amount, { plus: total.plus })
          })
          : el("span", { class: "tag tag-tbd", text: "TBD" }),
        el("p", {
          class: "substat",
          text: total.breakdown || (data.dashboard && data.dashboard.knownTotal && data.dashboard.knownTotal.note) || ""
        }),
        el("p", {
          class: "note",
          text: (data.dashboard && data.dashboard.knownTotal && data.dashboard.knownTotal.note) || ""
        })
      ])
    ]);

    var ammoCard = el("article", { class: "card" }, [
      el("div", { class: "card-top" }, [
        el("h3", { text: "Ammo vs " + formatCount(goalDefault(data)) + "-round goal" }),
        enteredCount === 0 ? el("span", { class: "tag tag-not-entered", text: "Not entered" }) : null
      ]),
      el("p", { class: "prose", text: ammoSummary })
    ]);
    ammoRows.forEach(function (row) {
      ammoCard.append(renderMeter(row, goalDefault(data), { compact: true }));
    });

    return el("div", { class: "stack" }, [grid, ammoCard]);
  }

  function renderArsenal(data) {
    var guns = data.arsenal || [];
    if (!guns.length) {
      return el("p", { class: "prose", text: "No owned guns entered." });
    }
    return el("div", { class: "cards cols-2" }, guns.map(renderGun));
  }

  function renderGun(gun) {
    var meta = [gun.caliber, gun.action, gun.role].filter(Boolean).join(" · ");
    return el("article", { class: "card" }, [
      el("div", { class: "card-top" }, [
        el("h3", { class: "card-title", text: gun.name }),
        statusTag(gun.status)
      ]),
      meta ? el("p", { class: "meta-line", text: meta }) : null,
      gun.details && gun.details.length ? list(gun.details) : null,
      gun.needs && gun.needs.length
        ? el("div", {}, [
          el("p", { class: "needs-label", text: "Needs" }),
          el("div", { class: "chips" }, gun.needs.map(function (need) {
            return el("span", { class: "chip", text: need });
          }))
        ])
        : null
    ]);
  }

  function renderAmmo(data) {
    var rows = data.ammo || [];
    var goal = goalDefault(data);
    var sameGoal = rows.every(function (row) {
      return (row.goal == null ? goal : Number(row.goal)) === goal;
    });
    var intro = sameGoal
      ? "Practice and defensive are tracked separately. Each goal is " + formatCount(goal) + " rounds. Counts not entered yet stay at zero."
      : "Practice and defensive are tracked separately. Each row uses its own goal.";
    return el("div", { class: "stack" }, [
      el("p", { class: "lead", text: intro }),
      el("div", { class: "stack" }, rows.map(function (row) {
        return renderMeter(row, goal, { compact: false });
      }))
    ]);
  }

  function renderMeter(row, defaultGoal, options) {
    var state = ammoState(row, defaultGoal);
    var practicePct = state.entered && state.goal > 0 ? Math.min(100, (state.practice / state.goal) * 100) : 0;
    var defensivePct = state.entered && state.goal > 0
      ? Math.min(100 - practicePct, (state.defensive / state.goal) * 100)
      : 0;
    var fraction = (state.entered ? formatCount(state.onHand) : "0") + " / " + formatCount(state.goal);
    var card = options.compact
      ? el("div", { class: "ammo-compact" })
      : el("article", { class: "card" });
    card.append(
      el("div", { class: "meter-head" }, [
        el("strong", { text: row.caliber }),
        el("span", { class: "meter-tools" }, [
          state.entered ? null : el("span", { class: "tag tag-not-entered", text: "Not entered" }),
          el("span", { class: "meter-scale", text: fraction })
        ])
      ]),
      el("div", {
        class: "meter",
        role: "progressbar",
        "aria-valuemin": "0",
        "aria-valuemax": String(state.goal),
        "aria-valuenow": String(state.entered ? state.onHand : 0),
        "aria-label": row.caliber + " on hand versus goal"
      }, [
        el("span", { class: "meter-practice", style: "width:" + practicePct + "%" }),
        el("span", { class: "meter-defensive", style: "width:" + defensivePct + "%" })
      ])
    );
    if (!options.compact) {
      card.append(el("div", { class: "split-counts" }, [
        el("span", {}, ["Practice ", el("strong", { text: state.entered ? formatCount(state.practice) : "0" })]),
        el("span", {}, ["Defensive ", el("strong", { text: state.entered ? formatCount(state.defensive) : "0" })]),
        el("span", {}, ["Goal ", el("strong", { text: formatCount(state.goal) })])
      ]));
    }
    return card;
  }

  function renderWishlist(data) {
    var root = el("div", {});
    (data.wishlist.tiers || []).forEach(function (tier) {
      var items = tier.items || [];
      var wide = items.some(function (item) { return item.kind === "build"; });
      root.append(el("section", { class: "tier", "aria-label": tier.label + " " + tier.name }, [
        el("p", { class: "tier-kicker", text: tier.label }),
        el("h3", { text: tier.name }),
        el("div", { class: wide ? "stack" : "cards cols-auto" }, items.map(renderWishItem))
      ]));
    });
    root.append(renderNonGlock(data.wishlist.nonGlock));
    return root;
  }

  function renderWishItem(item) {
    if (item.kind === "build") return renderBuild(item);
    if (item.kind === "offers") return renderOffers(item);
    return renderSimpleItem(item);
  }

  function renderSimpleItem(item) {
    return el("article", { class: "card" }, [
      el("div", { class: "card-top" }, [
        el("h4", { class: "card-title", text: item.name }),
        statusTag(item.status)
      ]),
      item.caliber ? el("p", { class: "meta-line", text: item.caliber }) : null,
      el("p", { class: "price-line" }, [moneyNode(item.price)]),
      item.summary ? el("p", { class: "prose", text: item.summary }) : null,
      item.details && item.details.length ? list(item.details) : null
    ]);
  }

  function renderBuild(item) {
    var rows = [{
      name: item.shortName || item.name,
      priceLow: item.priceLow,
      priceRecommended: item.priceRecommended,
      planned: true
    }].concat(item.alternatives || []);
    return el("article", { class: "card" + (item.planned ? " top-pick" : "") }, [
      el("div", { class: "card-top" }, [
        el("h4", { class: "card-title", text: item.name }),
        statusTag(item.status)
      ]),
      item.planned ? el("p", { class: "meta-line", text: "Next planned buy" }) : null,
      el("div", { class: "price-pair" }, [
        priceBlock("Low", item.priceLow),
        priceBlock("Recommended", item.priceRecommended)
      ]),
      el("ul", { class: "component-list" }, (item.components || []).map(function (part) {
        return el("li", {}, [
          el("span", { text: part.name }),
          part.price == null ? el("span", { class: "tag tag-tbd", text: "TBD" }) : el("span", { class: "price", text: formatMoney(part.price) })
        ]);
      })),
      item.priceNote ? el("p", { class: "note", text: item.priceNote }) : null,
      rows.length > 1 ? el("h4", { class: "needs-label", text: "Alternate pistols, build totals" }) : null,
      rows.length > 1 ? buildTable(rows) : null
    ]);
  }

  function renderOffers(item) {
    var prices = (item.offers || []).map(function (offer) { return offer.price; }).filter(isFiniteNumber);
    var lowest = prices.length ? Math.min.apply(null, prices) : null;
    return el("article", { class: "card" }, [
      el("div", { class: "card-top" }, [
        el("h4", { class: "card-title", text: item.name }),
        statusTag(item.status)
      ]),
      item.summary ? el("p", { class: "prose", text: item.summary }) : null,
      el("div", { class: "offer-list" }, (item.offers || []).map(function (offer) {
        var href = safeUrl(offer.url);
        var body = [
          el("span", {}, [
            el("span", { class: "offer-vendor", text: offer.vendor }),
            href ? el("span", { class: "offer-host", text: hostOf(href) }) : null
          ]),
          el("span", { class: "offer-price" }, [
            moneyNode(offer.price),
            lowest != null && offer.price === lowest
              ? el("span", { class: "tag tag-olive", text: "Lowest listed" })
              : null
          ])
        ];
        if (!href) return el("div", { class: "offer-row" }, body);
        return el("a", {
          class: "offer-row",
          href: href,
          target: "_blank",
          rel: "noopener noreferrer"
        }, body);
      }))
    ]);
  }

  function renderNonGlock(block) {
    if (!block) return null;
    return el("section", { class: "tier", "aria-label": block.title }, [
      el("h3", { text: block.title }),
      el("div", { class: "table-scroll" }, [
        el("table", {}, [
          el("thead", {}, [
            el("tr", {}, [
              el("th", { scope: "col", text: "Pistol" }),
              el("th", { scope: "col", text: "Gun price" }),
              el("th", { scope: "col", text: "Approx. build" })
            ])
          ]),
          el("tbody", {}, (block.items || []).map(function (item) {
            return el("tr", {}, [
              el("th", { scope: "row", text: item.name }),
              el("td", {}, [moneyNode(item.gunPrice)]),
              el("td", {}, [moneyNode(item.buildEstimate, { approx: true })])
            ]);
          }))
        ])
      ])
    ]);
  }

  function renderCarry(data) {
    var carry = data.carry || {};
    var contenders = carry.contenders || [];
    var pair = contenders.map(function (gun, index) {
      var card = el("article", { class: "card" + (gun.topPick ? " top-pick" : "") }, [
        el("div", { class: "card-top" }, [
          el("h3", { class: "card-title", text: gun.name }),
          gun.topPick ? el("span", { class: "badge badge-olive", text: "Top pick" }) : null
        ]),
        gun.capacity ? el("p", { class: "stat-value stat-text", text: gun.capacity }) : null,
        gun.points && gun.points.length ? list(gun.points) : null
      ]);
      if (index === 0 && contenders.length > 1) {
        return [card, el("p", { class: "vs", text: "vs" })];
      }
      return card;
    });
    return el("div", {}, [
      carry.summary ? el("p", { class: "lead", text: carry.summary }) : null,
      carry.pricesNote ? el("p", { class: "note", text: carry.pricesNote }) : null,
      el("div", { class: "compare" }, pair),
      (carry.alternatives || []).length
        ? el("h3", { class: "needs-label", text: "Also considered" })
        : null,
      (carry.alternatives || []).length
        ? el("ul", { class: "alt-list" }, carry.alternatives.map(function (name) {
          return el("li", { text: name });
        }))
        : null
    ]);
  }

  function renderMagMap(data) {
    var map = data.magMap || {};
    var groups = {};
    (map.groups || []).forEach(function (group) {
      groups[group.id] = group;
    });
    return el("div", { class: "stack" }, [
      map.intro ? el("p", { class: "lead", text: map.intro }) : null,
      el("div", { class: "legend" }, (map.groups || []).map(function (group) {
        return el("span", { class: "legend-item" }, [
          groupTag(group),
          el("span", { text: group.detail || "" })
        ]);
      })),
      el("div", { class: "table-scroll" }, [
        el("table", {}, [
          el("thead", {}, [
            el("tr", {}, ["Gun", "Group", "Status", "Caliber", "Magazine type", "Shares mags with", "Shares ammo with"].map(function (label) {
              return el("th", { scope: "col", text: label });
            }))
          ]),
          el("tbody", {}, (map.rows || []).map(function (row) {
            var group = groups[row.group] || { label: row.group || "", tone: "tan" };
            return el("tr", {}, [
              el("th", { scope: "row", text: row.gun }),
              el("td", {}, [groupTag(group)]),
              el("td", {}, [statusTag(row.status)]),
              el("td", { text: row.caliber }),
              el("td", { text: row.magazine }),
              el("td", { text: row.sharesMagsWith }),
              el("td", { text: row.sharesAmmoWith })
            ]);
          }))
        ])
      ])
    ]);
  }

  function renderNotes(data) {
    var notes = data.notes || {};
    return el("div", {}, [
      el("div", { class: "law-list" }, (notes.items || []).map(function (item) {
        return el("article", { class: "card law-card" }, [
          el("h3", { text: item.title }),
          el("p", { class: "prose", text: item.text })
        ]);
      })),
      notes.lastChecked ? el("p", { class: "checked", text: "Last checked " + notes.lastChecked }) : null
    ]);
  }

  function buildTable(rows) {
    return el("div", { class: "table-scroll" }, [
      el("table", {}, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", { scope: "col", text: "Pistol" }),
            el("th", { scope: "col", text: "Low" }),
            el("th", { scope: "col", text: "Recommended" })
          ])
        ]),
        el("tbody", {}, rows.map(function (row) {
          return el("tr", {}, [
            el("th", { scope: "row" }, [
              document.createTextNode(row.name),
              row.planned ? el("span", { class: "tag tag-olive planned-flag", text: "Planned" }) : null
            ]),
            el("td", {}, [moneyNode(row.priceLow)]),
            el("td", {}, [moneyNode(row.priceRecommended)])
          ]);
        }))
      ])
    ]);
  }

  function priceBlock(label, value) {
    return el("div", {}, [
      el("span", { class: "price-label", text: label }),
      moneyNode(value, { large: true })
    ]);
  }

  function moneyNode(value, options) {
    options = options || {};
    var text = formatMoney(value, options);
    if (!text) return el("span", { class: "tag tag-tbd", text: "TBD" });
    return el("span", { class: "price" + (options.large ? " price-lg" : ""), text: text });
  }

  function statusTag(status) {
    if (!status) return null;
    var slug = String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return el("span", { class: "tag tag-" + slug, text: status });
  }

  function groupTag(group) {
    return el("span", { class: "tag tag-" + (group.tone || "tan"), text: group.label || "" });
  }

  function list(items) {
    return el("ul", { class: "clean" }, items.map(function (item) {
      return el("li", { text: item });
    }));
  }

  function knownTotal(data) {
    var spec = data.dashboard && data.dashboard.knownTotal;
    if (!spec || !spec.parts) return { complete: false, amount: null, plus: false, breakdown: "" };
    var parts = [];
    for (var i = 0; i < spec.parts.length; i += 1) {
      var part = spec.parts[i];
      var amount = partAmount(data, part);
      if (amount == null) return { complete: false, amount: null, plus: !!spec.trailingPlus, breakdown: "" };
      parts.push({ label: part.label, amount: amount });
    }
    var cents = parts.reduce(function (sum, part) {
      return sum + Math.round(part.amount * 100);
    }, 0);
    var breakdown = parts.map(function (part) {
      return part.label + " " + formatMoney(part.amount);
    }).join(" + ");
    return {
      complete: true,
      amount: cents / 100,
      plus: !!spec.trailingPlus,
      breakdown: breakdown
    };
  }

  function partAmount(data, part) {
    var item = findItem(data, part.itemId);
    if (!item) return null;
    if (part.field === "priceLow" || part.field === "priceRecommended" || part.field === "price") {
      return isFiniteNumber(item[part.field]) ? Number(item[part.field]) : null;
    }
    if (part.field === "lowestOffer") {
      var prices = (item.offers || []).map(function (offer) { return offer.price; }).filter(isFiniteNumber);
      if (!prices.length) return null;
      return Math.min.apply(null, prices);
    }
    return null;
  }

  function findItem(data, id) {
    if (!id) return null;
    var tiers = (data.wishlist && data.wishlist.tiers) || [];
    for (var i = 0; i < tiers.length; i += 1) {
      var items = tiers[i].items || [];
      for (var j = 0; j < items.length; j += 1) {
        if (items[j].id === id) return items[j];
      }
    }
    return null;
  }

  function ammoState(row, defaultGoal) {
    var practice = num(row.practice);
    var defensive = num(row.defensive);
    var goal = row.goal == null ? defaultGoal : num(row.goal);
    return {
      practice: practice,
      defensive: defensive,
      goal: goal,
      entered: row.entered === true,
      onHand: practice + defensive
    };
  }

  function goalDefault(data) {
    var value = data.meta && data.meta.ammoGoalDefault;
    return isFiniteNumber(value) ? Number(value) : 1000;
  }

  function formatMoney(value, options) {
    options = options || {};
    if (!isFiniteNumber(value)) return null;
    var number = value;
    var whole = Math.round(number * 100) % 100 === 0;
    var digits = options.approx && whole ? 0 : 2;
    var text = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(number);
    return (options.approx ? "~" : "") + text + (options.plus ? "+" : "");
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US").format(num(value));
  }

  function num(value) {
    var number = Number(value);
    return isFiniteNumber(number) ? number : 0;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function safeUrl(url) {
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (error) {
      return null;
    }
    return null;
  }

  function hostOf(url) {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch (error) {
      return "";
    }
  }

  function watchNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
    var sectionsById = {};
    links.forEach(function (link) {
      var id = (link.getAttribute("href") || "").slice(1);
      var section = document.getElementById(id);
      if (section) sectionsById[id] = section;
    });
    if (!("IntersectionObserver" in window)) {
      if (links[0]) links[0].setAttribute("aria-current", "location");
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          if (link.getAttribute("href") === "#" + entry.target.id) {
            link.setAttribute("aria-current", "location");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    Object.keys(sectionsById).forEach(function (id) {
      observer.observe(sectionsById[id]);
    });
  }

  function showBoot(message, isError) {
    boot.hidden = false;
    boot.textContent = message;
    boot.classList.toggle("error", !!isError);
    boot.setAttribute("role", isError ? "alert" : "status");
    sections.hidden = true;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "style") node.setAttribute("style", value);
      else node.setAttribute(key, value);
    });
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children == null) return;
    var list = Array.isArray(children) ? children : [children];
    flatten(list).forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
  }

  function flatten(list) {
    var out = [];
    list.forEach(function (item) {
      if (Array.isArray(item)) {
        item.forEach(function (inner) { out.push(inner); });
      } else {
        out.push(item);
      }
    });
    return out;
  }
})();
