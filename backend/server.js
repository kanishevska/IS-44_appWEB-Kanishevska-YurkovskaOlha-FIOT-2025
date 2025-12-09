const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..")));

app.use('/images', express.static(path.join(__dirname, '..', 'images')));

const dbConfig = {
  user: "sa",
  password: "8a!4Bs*3",
  server: "localhost",
  database: "shelterDB",
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};


let poolPromise = null;
async function getPool() {
  if (!poolPromise) poolPromise = sql.connect(dbConfig);
  return poolPromise;
}

app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

app.use((req, res, next) => {
  console.log('REQ URL:', req.method, req.url);
  next();
});

// -------------------
// Root
// -------------------
app.get("/", (req, res) => res.send("Backend працює ✔️"));
app.get("/test", (req, res) => res.send("API працює!"));

// -------------------
// РЕЄСТРАЦІЯ / ЛОГІН 
// -------------------
app.post("/api/register", async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ message: "Заповніть усі поля" });
  }

  try {
    const pool = await getPool();

    const exists = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT TOP(1) * FROM Users WHERE Email = @email");

    if (exists.recordset.length > 0) {
      return res.status(400).json({ message: "Користувач з такою поштою вже існує" });
    }

    await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("username", sql.NVarChar, username)
      .input("password", sql.NVarChar, password)
      .input("roleId", sql.Int, 2)
      .query(
        `INSERT INTO Users (Email, Username, Password, RoleID)
         VALUES (@email, @username, @password, @roleId)`
      );

    res.json({ message: "Реєстрація успішна" });
  } catch (err) {
    console.error("Register ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Заповніть усі поля" });

  try {
    const pool = await getPool();

    const result = await pool.request()
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE Email = @email");

    if (result.recordset.length === 0) {
      return res.status(400).json({ message: "Користувача не знайдено" });
    }

    const user = result.recordset[0];

    if (user.Password !== password) {
      return res.status(400).json({ message: "Невірний пароль" });
    }

    res.json({
      message: "Вхід успішний",
      user: {
        UserID: user.UserID,
        Email: user.Email,
        Username: user.Username,
        RoleID: user.RoleID
      }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// -------------------
// ТВАРИНИ: GET
// -------------------
app.get("/api/animals", async (req, res) => {
  const type = req.query.type;
  try {
    const pool = await getPool();
    const reqq = pool.request();

    let sqlText = "SELECT * FROM Animals";
    if (type) {
      sqlText += " WHERE LOWER(Species) = LOWER(@type)";
      reqq.input("type", sql.NVarChar, type);
    }

    const result = await reqq.query(sqlText);
    res.json(result.recordset);
  } catch (err) {
    console.error("GET /api/animals ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

app.get("/api/animals/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Невірний id" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Animals WHERE AnimalID = @id");

    if (result.recordset.length === 0) return res.status(404).json({ message: "Тварина не знайдена" });

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("GET /api/animals/:id ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// -------------------
// ТВАРИНИ: POST
// -------------------
app.post("/api/animals", async (req, res) => {
  // очікується: Name, Species, Breed, Age, Gender, HealthStatus, Description, ImageURL
  const { Name, Species, Breed, Age, Gender, HealthStatus, Description, ImageURL } = req.body;

  if (!Name || !Species) {
    return res.status(400).json({ message: "Недостатньо даних (Name або Species)" });
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input("Name", sql.NVarChar, Name)
      .input("Species", sql.NVarChar, Species)
      .input("Breed", sql.NVarChar, Breed || null)
      .input("Age", sql.NVarChar, Age || null)
      .input("Gender", sql.NVarChar, Gender || null)
      .input("HealthStatus", sql.NVarChar, HealthStatus || null)
      .input("Description", sql.NVarChar, Description || null)
      .input("ImageURL", sql.NVarChar, ImageURL || null)
      .query(`
        INSERT INTO Animals (Name, Species, Breed, Age, Gender, HealthStatus, Description, ImageURL, Status, CreatedAt)
        VALUES (@Name, @Species, @Breed, @Age, @Gender, @HealthStatus, @Description, @ImageURL, 'available', GETDATE())
      `);

    res.json({ message: "Тваринку додано" });
  } catch (err) {
    console.error("POST /api/animals ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// -------------------
// ТВАРИНИ: PUT
// -------------------
app.put("/api/animals/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { Name, Species, Breed, Age, Gender, HealthStatus, Description, ImageURL, Status } = req.body;

  if (Number.isNaN(id)) return res.status(400).json({ message: "Невірний id" });

  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, id)
      .input("Name", sql.NVarChar, Name)
      .input("Species", sql.NVarChar, Species)
      .input("Breed", sql.NVarChar, Breed || null)
      .input("Age", sql.NVarChar, Age || null)
      .input("Gender", sql.NVarChar, Gender || null)
      .input("HealthStatus", sql.NVarChar, HealthStatus || null)
      .input("Description", sql.NVarChar, Description || null)
      .input("ImageURL", sql.NVarChar, ImageURL || null)
      .input("Status", sql.NVarChar, Status || null)
      .query(`
        UPDATE Animals SET
          Name = COALESCE(@Name, Name),
          Species = COALESCE(@Species, Species),
          Breed = COALESCE(@Breed, Breed),
          Age = COALESCE(@Age, Age),
          Gender = COALESCE(@Gender, Gender),
          HealthStatus = COALESCE(@HealthStatus, HealthStatus),
          Description = COALESCE(@Description, Description),
          ImageURL = COALESCE(@ImageURL, ImageURL),
          Status = COALESCE(@Status, Status)
        WHERE AnimalID = @id
      `);

    res.json({ message: "Тваринку оновлено" });
  } catch (err) {
    console.error("PUT /api/animals/:id ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// -------------------
// ТВАРИНИ: DELETE
// -------------------
app.delete("/api/animals/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Невірний id" });

  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Animals WHERE AnimalID = @id");

    res.json({ message: "Тварину видалено" });
  } catch (err) {
    console.error("DELETE /api/animals/:id ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// -------------------
// LIKE
// -------------------
app.post("/api/like", async (req, res) => {
  const { userId, animalId } = req.body;
  if (!userId || !animalId) return res.status(400).json({ message: "Недостатньо даних" });

  try {
    const pool = await getPool();

    const check = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("animalId", sql.Int, animalId)
      .query("SELECT * FROM AnimalLikes WHERE UserID=@userId AND AnimalID=@animalId");

    if (check.recordset.length > 0) return res.status(400).json({ message: "Вже вподобано" });

    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("animalId", sql.Int, animalId)
      .query("INSERT INTO AnimalLikes (UserID, AnimalID) VALUES (@userId, @animalId)");

    res.json({ message: "Тварину вподобано" });
  } catch (err) {
    console.error("POST /api/like ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

app.delete("/api/unlike", async (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  const animalId = parseInt(req.query.animalId, 10);
  if (Number.isNaN(userId) || Number.isNaN(animalId)) return res.status(400).json({ message: "Недостатньо даних" });

  try {
    const pool = await getPool();
    await pool.request()
      .input("userId", sql.Int, userId)
      .input("animalId", sql.Int, animalId)
      .query("DELETE FROM AnimalLikes WHERE UserID=@userId AND AnimalID=@animalId");

    res.json({ message: "Вподобання видалено" });
  } catch (err) {
    console.error("DELETE /api/unlike ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

app.get("/api/liked/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) return res.status(400).json({ message: "Невірний userId" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT A.*
        FROM AnimalLikes AL
        JOIN Animals A ON AL.AnimalID = A.AnimalID
        WHERE AL.UserID = @userId
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("GET /api/liked/:userId ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// -------------------
// ADOPTION
// -------------------
app.get("/api/adoption", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT AR.RequestID, AR.FullName, AR.BirthDate, AR.AnimalID, A.Name as AnimalName,
             AR.City, AR.Phone, AR.Experience, AR.TimeAlone, AR.Status, AR.SubmittedAt
      FROM AdoptionRequests AR
      LEFT JOIN Animals A ON AR.AnimalID = A.AnimalID
      ORDER BY AR.SubmittedAt DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("GET /api/adoption ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

app.put("/api/adoption/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ message: "Невірний id" });

  try {
    const pool = await getPool();

    // Оновлення статусу
    await pool.request()
      .input("id", sql.Int, id)
      .input("status", sql.NVarChar, "done")
      .query(`
        UPDATE AdoptionRequests 
        SET Status = @status 
        WHERE RequestID = @id
      `);

    // Видалення
    await pool.request()
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM AdoptionRequests 
        WHERE RequestID = @id
      `);

    res.json({ message: "Заявку оброблено та видалено" });
  } catch (err) {
    console.error("PUT /api/adoption/:id ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// -------------------
// SECTIONS
// -------------------
app.get("/api/sections", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT SectionName, Content FROM ContentSections
    `);

    const sections = {
      volunteer: "",
      help: ""
    };

    result.recordset.forEach(r => {
      if (r.SectionName === "Волонтерство") {
        sections.volunteer = r.Content;
      }
      if (r.SectionName === "Допомога") {
        sections.help = r.Content;
      }
    });

    res.json(sections);

  } catch (err) {
    console.error("GET /api/sections ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});


app.put("/api/sections", async (req, res) => {
  const { volunteer, help } = req.body;

  try {
    const pool = await getPool();

    // Волонтерство
    await pool.request()
      .input("content", sql.NVarChar, volunteer || "")
      .query(`
        UPDATE ContentSections
        SET Content = @content, UpdatedAt = GETDATE()
        WHERE SectionName = N'Волонтерство'
      `);

    // Допомога
    await pool.request()
      .input("content", sql.NVarChar, help || "")
      .query(`
        UPDATE ContentSections
        SET Content = @content, UpdatedAt = GETDATE()
        WHERE SectionName = N'Допомога'
      `);

    res.json({ message: "Секції оновлено" });

  } catch (err) {
    console.error("PUT /api/sections ERROR:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});


// -------------------
// Server running on...
// -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
